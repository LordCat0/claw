const uid = require('./uid');

class Scope {
    constructor (parent = null, isFunction = false) {
        this.parent = parent;
        this.isFunction = isFunction;
        this.id = uid.shortUid();
        this.variables = {};
        this.variableIds = {};
        this.functions = {};
        this.params = {};
        this.lastBlock = null;
    }

    defineVariable (name, id) {
        if (name in this.variables) {
            throw new Error(`Variable "${name}" is already defined in this scope.`);
        }
        this.variables[name] = `${name}@${this.id}`;
        this.variableIds[name] = id;
    }

    defineParam (name) {
        this.params[name] = true;
    }

    importVariable (name, scopedName, id) {
        this.variables[name] = scopedName;
        this.variableIds[name] = id;
    }

    defineFunction (name, mutation) {
        this.functions[name] = mutation;
    }

    resolveVariable (name) {
        if (name in this.variables) 
            return {
                type: 'variable',
                name: this.variables[name],
                id: this.variableIds[name]
            };
        if (name in this.params) return { type: 'parameter' };
        if (name in this.functions) return { type: 'function' };
        if (this.parent) return this.parent.resolveVariable(name);
        return null;
    }

    resolveFunction (name) {
        if (name in this.functions) return this.functions[name];
        if (this.parent) return this.parent.resolveFunction(name);
        return null;
    }

    createChild (newFunction) {
        return new Scope(this, newFunction || this.isFunction);
    }
}

module.exports = Scope;
