
// Handles mouse and keyboard events. Tells you the current state
// of the mouse and which keys are pressed, for easy of use in
// game code (for example, in requestAnimationFrame())
function DCInput(canvas) {

    // Map key codes to clean event names
    this.keyMap = {
        38:'up', 40:'down', 37: 'right', 39:'left', //arrow keys
        87:'up', 83:'down', 65: 'right', 68:'left', //wasd
        81:'strafeleft', 69:'straferight' //qe
    }

    // Currently pressed keys, {'up':true} if up is currently pressed
    this.keys = {} 

    // Mouse status, last location, and how much it's moved since the last check
    this.mouse = {
        'pointerLock':false,
        'drag':false,
        'last':{x:0,y:0},
        'move':{x:0,y:0}
    }

    this.getAndClearMouseMove = function() {
        var ret = this.mouse.move
        this.mouse.move = {x:0, y:0}
        return ret
    }

    this.requestPointerLock = function() {
        var fn = canvas.requestPointerLock ||
           canvas.mozRequestPointerLock ||
           canvas.webkitRequestPointerLock
        // Ask the browser to lock the pointer
        fn.apply(canvas)
    }


    // Private event handlers

    function onKeyUp(ev) {
        var key = ev.keyCode
        if(this.keyMap[key]){
            var mapped = this.keyMap[key]
            this.keys[mapped] = false
        }
    }
    function onKeyDown(ev){
        var key = ev.keyCode
        if(this.keyMap[key]){
            this.keys[this.keyMap[key]] = true
            console.log(this.keyMap[key])
        }
    }

    function onMouseUp(ev) {
        this.mouse.drag = false
    }
    function onMouseDown(ev) {
        this.mouse.drag = this.mouse.last = {x:ev.screenX, y:ev.screenY}
    }
    function onMouseMove(ev) {
        var movementX, movementY;
        if(this.mouse.pointerLock){
            movementX = ev.movementX ||
                ev.mozMovementX ||
                ev.webkitMovementX ||
                0
            movementY = ev.movementY ||
                ev.mozMovementY ||
                ev.webkitMovementY ||
                0
        } else {
          movementX = ev.screenX - this.mouse.last.x
          movementY = ev.screenY - this.mouse.last.y
        }
        this.mouse.move.x += movementX
        this.mouse.move.y += movementY
        this.mouse.last.x = ev.screenX
        this.mouse.last.y = ev.screenY
    }
    function onMouseEnter(ev) {
    }
    function onMouseLeave(ev) {
        this.mouse.drag = false
    }


    function onPointerLock(ev) {
        this.mouse.pointerLock = !!document.pointerLockElement
    }


    //Initialization
    window.addEventListener('keydown', onKeyDown.bind(this), false)
    window.addEventListener('keyup', onKeyUp.bind(this), false)
    canvas.addEventListener('mousedown', onMouseDown.bind(this), false)
    canvas.addEventListener('mouseup', onMouseUp.bind(this), false)
    canvas.addEventListener('mousemove', onMouseMove.bind(this), false)
    canvas.addEventListener('mouseenter', onMouseEnter.bind(this), false)
    canvas.addEventListener('mouseleave', onMouseLeave.bind(this), false)
    document.addEventListener('pointerlockchange', onPointerLock.bind(this), false)
    document.addEventListener('mozpointerlockchange', onPointerLock.bind(this), false)
    document.addEventListener('webkitpointerlockchange', onPointerLock.bind(this), false)
}

