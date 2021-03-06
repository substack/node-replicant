var patcher = require('patcher');
var JSONStream = null;
try {
    JSONStream = (require)('stream').Stream
        ? (require)('JSONStream') : null
    ;
} catch (e) {}

var EventEmitter = require('events').EventEmitter;

var replicant = module.exports = function (obj) {
    if (obj === undefined) obj = {};
    
    var self = function (cb) {
        if (cb.length === 2) {
            var ref = patcher.clone(self.object);
            cb(ref, update);
        }
        else {
            var ref = patcher.clone(self.object);
            cb(ref);
            update(ref);
        }
        
        function update (next) {
            var patch = patcher.computePatch(self.object, next);
            self.object = next;
            self.emit('patch', patch);
        }
    };
    
    self.object = patcher.clone(obj);
    
    var pipeTargets = [];
    var pipeListeners = [];
    
    self.pipe = function (target) {
        if (typeof target === 'function' && !target.on) {
            pipeTargets.push(target);
            pipeListeners.push(target);
            
            self.on('patch', target);
            target(patcher.computePatch({}, self.object));
            return self;
        }
        else if (target.patch) {
            self.on('patch', target.patch);
            
            pipeTargets.push(target);
            pipeListeners.push(target.patch);
            
            target.patch(patcher.computePatch({}, self.object));
            return self;
        }
        else if (JSONStream) {
            var stringify = JSONStream.stringify();
            stringify.pipe(target);
            
            var onpatch = function (patch) {
                stringify.write(patch);
            }
            self.on('patch', onpatch);
            
            pipeTargets.push(target);
            pipeListeners.push(onpatch);
            
            stringify.write(patcher.computePatch({}, self.object));
            
            return self;
        }
    };
    
    self.unpipe = function (target) {
        var ix = pipeTargets.indexOf(target);
        if (ix >= 0) {
            self.removeListener('patch', pipeListeners[ix]);
            pipeTargets.splice(ix, 1);
            pipeListeners.splice(ix, 1);
        }
    };
    
    self.writable = true;
    self.readable = true;
    
    self.patch = function (patch) {
        if (patch !== null) {
            patcher.applyPatch(self.object, patch);
            self.emit('update', self.object);
        }
    };
    
    for (var key in EventEmitter.prototype) {
        if (typeof EventEmitter.prototype[key] === 'function') {
            self[key] = EventEmitter.prototype[key];
        }
    }
    
    if (JSONStream) {
        var parse = JSONStream.parse([ /./ ]);
        self.write = parse.write.bind(parse);
        
        parse.on('data', function (patch) {
            self.patch(patch);
        });
    }
    
    return self;
};

replicant.join = function (a, b) {
    a.pipe(b);
    b.pipe(a);
};
