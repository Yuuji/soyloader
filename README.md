Soyloader
=============

Soyloader helps to convert and include soy templates

Use
-------

The templateDir option is always the directory where the soy files ale located.
The soyFile option has three posible value:

1.

    require('soyloader')({
        templateDir: process.cwd() + '/templates',
        soyFile: false,
        logging: false
    });

This will include soy templates into the running node process.
If you have a templates named "templates.hello.world" you can use it:

    console.log(templates.hello.world());


2.

    require('soyloader')({
        templateDir: process.cwd() + '/templates',
        soyFile: process.cwd() + '/static/js/templates.js',
        logging: false
    });

This will convert the soy templates and write them to the given filename.
All templates will be collected in this one file.


3.

    require('soyloader')({
        templateDir: process.cwd() + '/templates',
        soyFile: process.cwd() + '/templates-js',
        logging: false
    });

Important: The soyFile option must be a existing folder!
This will convert the soy templates and will create one js file per soy file.
The name and the folder structure will be the same as the origin structure.


For debugging you can set the logging option to true


License
-------

Soyloader is GPLv2, see LICENSE

SoyToJsSrcCompiler.jar is Apache License 2.0:
License: http://www.apache.org/licenses/LICENSE-2.0
Source: https://code.google.com/p/closure-templates/
