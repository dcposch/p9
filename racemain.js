/**
 * DC
 * Nov 2011
 * Game logic, car model, physics for glrace.
 */

// dom
var canvas = $("#gl");

// world
var scene = [];
var car = {};
var nissan_gtr = {
    mass:1800, //kg
    cda:6.0, //m^2
    max_skid_lat:4.0, //about 0.5g skidpad
    max_skid_vert:9.0, //about 1g skidpad
    max_power:500 //Mine's GTR, 500kW/800hp
    };
var model = nissan_gtr;
var env = {temp:20}; //20C

//constants
//all in metric: meters, meter/s, meters/s^2, rads/sec, etc
var reverse_accel = 1.0;
var max_speed_reverse = 10; //36 km/h
//density of air
var calc_rho = function(){
    return 1.2920 - env.temp*0.00425;
}
var calc_drag = function(){
    var rho = calc_rho();
    var drag = 0.5*model.cda*rho*car.speed*car.speed;
    return drag;
}
var calc_drag_accel = function(){ 
    var a = calc_drag() / model.mass;
    if(car.speed < 0)
        return a;
    return -a;
}
var calc_fwd_accel = function(speed){ 
    var drag_accel = calc_drag_accel();
    var power_accel = model.max_power*1000/Math.abs(car.speed*model.mass+0.001) + drag_accel;
    var skid_accel = model.max_skid_vert + drag_accel;
    if(power_accel > skid_accel){
        car.calc_accel_lim = "traction";
        return skid_accel;
    } else {
        car.calc_accel_lim = "power";
        return power_accel;
    }
}
var calc_brake_accel = function(speed){ 
    //TODO:
    return -model.max_skid_vert + calc_drag_accel(speed);
}
var calc_lateral_accel = function(){
    //max accel in arbitrary dir is an ellipse, 
    //major axis: max_skid_vert, minor axis: max_sid_lat
    var a = model.max_skid_vert*model.max_skid_vert - car.accel*car.accel;
    if(a < 0) return 0;
    return Math.sqrt(a)*model.max_skid_lat/model.max_skid_vert;
}
var shift_delay = 0.1;
var max_steer = 1.5; //radians per meter


function drawScene() {

    //scale, clear window
    var width = canvas.width();
    var height = canvas.height();
    canvas[0].width = width;
    canvas[0].height = height;
    gl.viewport(0, 0, width, height); 
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    //setup camera
    mat4.perspective(50, width / height, 0.1, 10000.0, pmat);

    //setup matrixes
    mat4.identity(mvmat);
    mat4.rotate(mvmat, -azith, [1,0,0]);
    mat4.rotate(mvmat, -dir, [0,1,0]);
    mat4.translate(mvmat, [-loc[0], -loc[1], -loc[2]]);

    //render
    for(var i = 0; i < scene.length; i++){
        var model = scene[i];

        //load material (shaders)
        if(model.vertex_shader && model.fragment_shader){
            setShaders(model.vertex_shader, model.fragment_shader);
        } else {
            setShaders("vert_simple", "frag_color");
        }
        //load model data
        setAttributes(model);

        //transform, render
        mvpush();
        mat4.translate(mvmat, vec3.create(model.position));
        if(model.heading)
            mat4.rotate(mvmat, -model.heading, [0,1,0]);
        setUniforms();


        //allow model to do fancy stuff
        if(model.prerender)
            model.prerender();

        if(model.tris){
            //draw element array (array contains vertex indices)
            var buf = gl.createBuffer();
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buf);
            var tris = new Uint16Array(model.tris);
            gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, tris, gl.STATIC_DRAW);
            gl.drawElements(gl.TRIANGLES, tris.length, gl.UNSIGNED_SHORT, 0);
        } else {
            //draw triangle array
            gl.drawArrays(gl.TRIANGLES, 0, model.nverts);
        }

        if(model.postrender)
            model.postrender();

        mvpop();
    }
}

function init(canvas) {
    //make a simple scene
    scene = [];
    car = genCar();
    scene.push(car);
    scene.push(genGrid());
    loadRoad(function(m){
        console.log("ADDING>..");
        scene.push(m);
    });

    initGL(canvas);
}

function update(){

    //keyboard
    var step_move = 2*dt;
    var step_turn = 0.03*dt;
    var dir = car.heading;
    var vforward = vec3.create(
        [-Math.sin(dir),0,-Math.cos(dir)]);
    var vright = vec3.create(
        [Math.cos(dir),0,-Math.sin(dir)]);
    vec3.scale(vforward, step_move);
    vec3.scale(vright, step_move);

    //get driver input
    var input = {};
    input.gas = (keys["up"] && 1.0) || 0.0;
    input.brake = (keys["down"] && 1.0) || 0.0;
    if(keys["left"]){
        input.steer = 1.0;
    } else if(keys["right"]){
        input.steer = -1.0;
    } else {
        input.steer = 0;
    }

    //modify car physics
    car.calc_accel_lim = null;
    if(input.gas){
        car.accel = calc_fwd_accel(car.speed)*input.gas;
        console.log(["WTF", input.gas, car.accel]);
    } else if(input.brake){
        if(car.speed < 0)
            //janky hack, but i don't care about sim accuracy in reverse gear
            car.accel = -reverse_accel;
        else
            car.accel = calc_brake_accel(car.speed)*input.brake;
    } else {
        car.accel = calc_drag_accel(car.speed);
    }

    var maxlat = calc_lateral_accel();
    car.steer = input.steer*Math.min(max_steer, maxlat/(Math.abs(car.speed)+0.001));

    //mouse -- modify camera
    var sensitivity_x = 0.01;
    var sensitivity_y = 0.01;
    var min_azith = -Math.PI/4;
    var max_azith = Math.PI/4;
    if(mouse.drag){
        dir += mouse.move.x*sensitivity_x;
        azith += mouse.move.y*sensitivity_y;
        azith = Math.max(min_azith, Math.min(max_azith, azith));
        mouse.move = {x:0, y:0};
    }

    //status
    var model = scene[0];
    var p = car.position;
    var stat = 
        model.positions.length + " vertices, " + 
        (model.positions.length*3*3*4/1000) + " KB model mem" +
        ", p ("+p[0].toFixed(1)+","+p[1].toFixed(1)+","+p[2].toFixed(1)+")" + 
        ", v ("+car.speed.toFixed(1)+","+car.steer.toFixed(2)+")";
    if(car.calc_accel_lim)
        stat += " "+car.calc_accel_lim+"-limited";
    $("#status").text(stat);

    physics();
    cameraTracking();
}

function physics(){
    var vmax = 200, vmin = -max_speed_reverse;
    if(car.accel < 0){
        if(car.speed > 0){
            vmin = 0;
        }
    } else {
        if(car.speed < 0){
            vmax = 0;
        }
    }
    car.speed = car.speed+car.accel*dt;
    car.speed = Math.max(Math.min(car.speed, vmax), vmin);

    //shifting
    if(car.speed == 0.0){
        //pause a bit before shifting into reverse
        if(!car.shift_start)
            car.shift_start = t;
        else if(t - car.shift_start >= shift_delay)
            car.speed += car.accel*dt;    
    } else{
        //done shifting, now in reverse
        car.shift_start = null;
    }

    car.heading += car.steer*car.speed*dt;
    car.direction = vec3.create([Math.cos(car.heading), 0, Math.sin(car.heading)]);
    var dpos = vec3.create(car.direction);
    vec3.scale(dpos, car.speed);
    vec3.add(car.position, dpos);
}

function cameraTracking(){
    // decay toward a place behind the car
    var target = vec3.create();
    var dpos = vec3.create(car.direction);
    vec3.scale(dpos, -30.0);
    vec3.add(car.position, dpos, target);
    target[1] = 5;

    vec3.subtract(target,loc);
    vec3.scale(target, 0.1);
    vec3.add(loc,target);

    // always look at the car
    vec3.subtract(car.position, loc, target);

    if(!mouse.drag){
        var decay = 0.8;
        var newDir = Math.atan2(-target[0], -target[2]);
        while(dir < newDir-Math.PI)
            dir += 2*Math.PI;
        while(dir > newDir+Math.PI)
            dir -= 2*Math.PI;
        dir = decay*dir + (1-decay)*newDir;
        azith = decay*azith;
    }
}

function frame(){
    update();
    drawScene();
}

function main(){
    var canvas = $("#gl")[0];
    init(canvas);
    animate(frame, canvas);
}

