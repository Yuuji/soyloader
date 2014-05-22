function soyloader(templateDir, soyFile, logging) {
    var chokidar = require('chokidar');
    var watcher = chokidar.watch(templateDir, {ignored: /^\./, persistent: true});
    var path = require('path');
    var fs = require('fs');
    var temp = require('temp');
    var sys = require('sys');
    var vm = require('vm');
    var exec = require('child_process').exec;
    var mkdirp = require('mkdirp');

    var logging = logging || false;

    var changes = {};
    var files = {};
    var working = {};
    var templates = {};
    var checkRunning = false;
    var doRebuildFile = false;
    var rebuildSoyInProgress = false;
    var buildSoyQueue = [];
    var buildSoyInProgress = 0;
    var buildSoyInProgressLast = 0;
    var numCPUs = require("os").cpus().length;

    templateDir = path.normalize(templateDir) + '/';

    function isEmpty(obj) {
        if (obj == null) {
            return true;
        }

        if (obj.length > 0) {
            return false;
        }

        if (obj.length === 0) {
            return true;
        }

        for (var key in obj) {
            if (hasOwnProperty.call(obj, key)){
                return false;
            }
        }

        return true;
    };

    var rebuildSoyFile = function() {
        if (soyFile === false) {
            return;
        }
        
        doRebuildFile = true;

        if (rebuildSoyInProgress) {
            return;
        }

        rebuildSoyInProgress = true;
        doRebuildFile = false;

        logging && console.log('Rebuilding soy file');

        var tempName = temp.path({suffix: '.js'});

        var fd = fs.openSync(tempName, 'w');

        for (var file in templates) {
            fs.writeSync(fd, templates[file].template, 0, templates[file].length);
        }

        fs.closeSync(fd);

        fs.renameSync(tempName, soyFile);
        rebuildSoyInProgress = false;

        logging && console.log('Rebuilding soy file done');

        if (doRebuildFile) {
            rebuildSoyFile();
        }
    };

    var buildSoy = function(file) {
        buildSoyQueue.push(file);
        buildSoyQueueProcess();
    };
    
    var buildSoyQueueProcess = function() {
        if (buildSoyInProgressLast!= buildSoyQueue.length) {
            logging && console.log('buildSoyQueue: ' + buildSoyQueue.length);
            buildSoyInProgressLast = buildSoyQueue.length;
        }
        
        if (buildSoyInProgress < numCPUs && buildSoyQueue.length>0) {
            var file = buildSoyQueue.shift();
            
            if (file) {
                buildSoyIntern(file);
            }
        }
    };
    
    var setLastModified = function(file, origFileStats) {
        if (soyFile === false) {
            templates[file].time = origFileStats.mtime.getTime();
            return true;
        } else  {
            var stats = fs.statSync(soyFile);
            if(stats.isDirectory()) {
                var newfilename = soyFile + (soyFile.substr(-1) === '/' ? '' : '/') + file;
                newfilename = newfilename.replace(/\.soy$/, '.js');
                var checkfilename = path.dirname(newfilename) + '/.' + path.basename(newfilename) + '.generator';
                
                mkdirp.sync(path.dirname(checkfilename));
                fs.writeFileSync(checkfilename, origFileStats.mtime.getTime());
            } else {
                templates[file].time = origFileStats.mtime.getTime();
                return true;
            }
        }
    };
    
    var checkIfModified = function(file, origFileStats) {
        if (soyFile === false) {
            if (!templates[file]) {
                return true;
            }
            
            if (templates[file].time < origFileStats.mtime.getTime()) {
                return true;
            }
            
            return false;
        } else  {
            var stats = fs.statSync(soyFile);
            if(stats.isDirectory()) {
                var newfilename = soyFile + (soyFile.substr(-1) === '/' ? '' : '/') + file;
                newfilename = newfilename.replace(/\.soy$/, '.js');
                
                if (!fs.existsSync(newfilename)) {
                    return true;
                }
                
                var checkfilename = path.dirname(newfilename) + '/.' + path.basename(newfilename) + '.generator';
                
                if (!fs.existsSync(checkfilename)) {
                    return true;
                }
                
                try {
                    var lastTimestamp = parseInt(fs.readFileSync(checkfilename),10);
                    
                    if (lastTimestamp < origFileStats.mtime.getTime()) {
                        return true;
                    }
                } catch (e) {
                    return true;
                }
                
                return false;
            } else {
                if (!templates[file]) {
                    return true;
                }

                if (templates[file].time < origFileStats.mtime.getTime()) {
                    return true;
                }

                return false;
            }
        }
    };
    
    var injectSoy = function(obj, where) {
        where = where || global;
        
        for(var key in obj) {
            if (where[key]) {
                injectSoy(obj[key], where[key]);
            } else {
                where[key] = obj[key];
            }
        }
    };

    var copySoyFunctions = function(obj, where) {
        where = where || global;

        for(var key in obj) {
            if (typeof obj[key] === 'function') {
                var temp;
                eval('temp = ' + obj[key].toString());
                where[key] = temp;
            } else if (typeof obj[key] === 'object') {
                copySoyFunctions(obj[key], where[key]);
            }
        }
    };
    
    var rejectSoy = function(obj, where) {
        where = where || global;
        
        for(var key in obj) {
            if (Object.keys(where[key]).length>0) {
                rejectSoy(obj[key], where[key]);
                 if (Object.keys(where[key]).length===0) {
                     delete where[key];
                 }
            } else {
                delete where[key];
            }
        }
    }
    
    var deleteSoy = function(file) {
        if (soyFile === false) {
            rejectSoy(templates[file].obj);
            delete templates[file];
        } else  {
            delete templates[file];
            var stats = fs.statSync(soyFile);
            if(stats.isDirectory()) {
                var newfilename = soyFile + (soyFile.substr(-1) === '/' ? '' : '/') + file;
                newfilename = newfilename.replace(/\.soy$/, '.js');
                
                if (fs.existsSync(newfilename)) {
                    fs.unlinkSync(newfilename);
                }
                
                var checkfilename = path.dirname(newfilename) + '/.' + path.basename(newfilename) + '.generator';
                
                if (fs.existsSync(checkfilename)) {
                    fs.unlinkSync(checkfilename);
                }
            } else {
                rebuildSoyFile();
            }
        }
    };
    
    var buildSoyIntern = function(file) {
        buildSoyInProgress++;

        var tempName = temp.path({suffix: '.js'});
        
        var type = soyFile ? 'STRINGBUILDER' : 'CONCAT';
        
        var origFileStats = fs.statSync(templateDir + file);
        
        if (checkIfModified(file, origFileStats)===false) {
            buildSoyInProgress--;
            setTimeout(buildSoyQueueProcess, 100);
            return;
        }
        
        logging && console.log('Build template ' + file);
        
        exec('/usr/bin/java -jar ' + __dirname + '/SoyToJsSrcCompiler.jar --codeStyle ' + type + ' --outputPathFormat ' + tempName + ' ' + templateDir + file, function (error, stdout, stderr) {
            buildSoyInProgress--;
            setTimeout(buildSoyQueueProcess, 100);
            if (error !== null) {
                logging && console.log('exec error: ' + error);
            }

            if (fs.existsSync(tempName)) {
                var template = fs.readFileSync(tempName, {encoding: 'utf8'});

                if (template.length>0) {
                    
                    if (soyFile === false && templates[file] && templates[file].obj) {
                        rejectSoy(templates[file].obj)
                    }
                    
                    templates[file] = {
                        template: template,
                        time: null // see last modified
                    }
                    
                    setLastModified(file, origFileStats);

                    if (soyFile === false) {
                        try {
                            var sandbox = {};
                            var script = vm.createScript(template);
                            script.runInNewContext(sandbox);
                            injectSoy(sandbox);
                            copySoyFunctions(sandbox);
                            templates[file].obj = sandbox;
                        } catch (e) {
                            console.log(e);
                            console.log('Could not eval for ' + file);
                        }
                    } else  {
                        var stats = fs.statSync(soyFile);
                        if(stats.isDirectory()) {
                            var newfilename = soyFile + (soyFile.substr(-1) === '/' ? '' : '/') + file;
                            newfilename = newfilename.replace(/\.soy$/, '.js');
                            mkdirp.sync(path.dirname(newfilename));
                            fs.writeFileSync(newfilename, template);
                        } else {
                            rebuildSoyFile();
                        }
                    }
                } else {
                    logging && console.log('Template empty?');
                }

                fs.unlinkSync(tempName);
            } else {
                logging && console.log('Template not build');
            }

            delete working[file];
        });
    };

    var checkSoy = function(file) {
        if (working[file]) {
            return false;
        }

        working[file] = file;

        if(!fs.existsSync(templateDir + file)) {
            logging && console.log('Remove template ' + file);
            deleteSoy(file);
            delete working[file];
        } else if (!templates[file]) {
            buildSoy(file);
        } else if (fs.statSync(templateDir + file).mtime.getTime() > templates[file].time) {
            buildSoy(file);
        }
    };

    var check = function() {
        if (checkRunning) {
            return;
        }

        if (isEmpty(changes)) {
            return;
        }

        checkRunning = true;

        for (var file in changes) {
            files[file] = file;
            if (path.extname(templateDir + file)!=='.soy') {
                // nothing to do
            } else {
                checkSoy(file);
            }
            delete changes[file];
        }

        checkRunning = false;

        check();
    };

    var add = function(path) {
        path = path.substr(templateDir.length);
        changes[path] = path;
        check();
    };
    watcher
        .on('add', add)
        .on('change', add)
        .on('unlink', add);
}

module.exports = soyloader;
