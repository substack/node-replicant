var patcher = require('patcher');
var JSONStream = require('JSONStream');
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
    
    self.pipe = function (target) {
        if (typeof target === 'function' && !target.on) {
            self.on('patch', target);
            target(patcher.computePatch({}, self.object));
            return;
        }
        
        var stringify = JSONStream.stringify();
        stringify.pipe(target);
        
        self.on('patch', function (patch) {
            stringify.write(patch);
        });
        
        stringify.write(patcher.computePatch({}, self.object));
        
        return self;
    };
    
    self.writable = true;
    self.readable = true;
    
    self.patch = function (patch) {
        patcher.applyPatch(self.object, patch);
        self.emit('update', self.object);
    };
    
    Object.keys(EventEmitter.prototype).forEach(function (key) {
        if (typeof EventEmitter.prototype[key] === 'function') {
            self[key] = EventEmitter.prototype[key];
        }
    });
    
    var parse = JSONStream.parse([ /./ ]);
    self.write = parse.write.bind(parse);
    
    parse.on('data', function (patch) {
        self.patch(patch);
    });
    
    return self;
};

replicant.join = function (a, b) {
    a.pipe(b);
    b.pipe(a);
};
