Soyloader
=============

Soyloader helps to convert and include soy templates

Use
-------

The first argument is always the directory where the soy files ale located.
The second argument has three posible value:

1.

    require('soyloader')(process.cwd() + '/templates', false);

This will include soy templates into the running node process.
If you have a templates named "templates.hello.world" you can use it:

    console.log(templates.hello.world());


2.

    require('soyloader')(process.cwd() + '/templates', process.cwd() + '/static/js/templates.js');

This will convert the soy templates and write them to the given filename.
All templates will be collected in this one file.


3.

    require('soyloader')(process.cwd() + '/templates', process.cwd() + '/templates-js');

Important: The second argument must be a existing folder!
This will convert the soy templates and will create one js file per soy file.
The name and the folder structure will be the same as the origin structure.


License
-------

Soyloader is GPLv2, see LICENSE

SoyToJsSrcCompiler.jar is Apache License 2.0:
License: http://www.apache.org/licenses/LICENSE-2.0
Source: https://code.google.com/p/closure-templates/
