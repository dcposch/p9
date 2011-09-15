

var keyMap = {
    38:'up', 40:'down', 37: 'right', 39:'left', //arrow keys
    87:'up', 83:'down', 65: 'right', 68:'left', //wasd
    81:'strafeleft', 69:'straferight' //qe
};

var keys = {}; //eg {'up':true} if up is currently pressed
var mouse = {
    'drag':false,
    'last':{x:0,y:0},
    'move':{x:0,y:0}
};

function onKeyUp(ev) {
    var key = ev.keyCode;
    if(keyMap[key]){
        var mapped = keyMap[key];
        keys[mapped] = false;
    }
}
function onKeyDown(ev){
    var key = ev.keyCode;
    if(keyMap[key]){
        keys[keyMap[key]] = true;
        console.log(keyMap[key]);
    }
}

function onMouseUp(ev) {
    mouse.drag = false;
}
function onMouseDown(ev) {
    mouse.drag = mouse.last = {x:ev.screenX, y:ev.screenY};
}
function onMouseMove(ev) {
    mouse.move = {x:ev.screenX-mouse.last.x, y:ev.screenY-mouse.last.y};
    mouse.last = {x:ev.screenX, y:ev.screenY};
}
function onMouseEnter(ev) {
}
function onMouseLeave(ev) {
    mouse.drag = false;
}

$(function(){
    $(window).keydown(onKeyDown);
    $(window).keyup(onKeyUp);
    $("canvas").mouseup(onMouseUp);
    $("canvas").mousedown(onMouseDown);
    $("canvas").mousemove(onMouseMove);
    $("canvas").mouseenter(onMouseEnter);
    $("canvas").mouseleave(onMouseLeave);
});

