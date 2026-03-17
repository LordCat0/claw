// todo: make an actual index.js file instead of just an output test

const path = require('path');
const fs = require('fs');
const Compiler = require('./compiler');

const compiler = new Compiler();
compiler.compile(path.resolve(__dirname, '../proto.claw'));
compiler.generateZip('nodebuffer').then(arr => {
    fs.writeFileSync(path.resolve(__dirname, '../prototype/proto.zip'), arr);
    fs.writeFileSync(path.resolve(__dirname, '../prototype/proto.sb3'), arr);
    fs.writeFileSync(path.resolve(__dirname, '../prototype/project.json'), JSON.stringify(compiler.toJSON()));
});