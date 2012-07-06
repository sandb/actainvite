function millis() {
	return new Date().getTime();
}

function r(range) {
	return Math.random() * range;
}

function rz(range) {
	var res = r(range);
	while (res == 0) res = r(range);
	return res; 
}

function rr(range) {
	return parseInt(r(range));
}

function zeroPad(str, length) {
	var zeros = "0000000000";
	while (length - str.length > zeros.length) 
		str = zeros + str;
	return zeros.substring(0, length-str.length) + str;
}

function loadimg(url) {
	var img = new Image();
	img.src = url;
	img.loaded = false;
	img.onload = function() {
	  img.loaded = true;
	}
	return img;
}

function dist(dx, dy) {
	return Math.sqrt(dx*dx + dy*dy);
}

function FakeAudio() {
	this.play = function() {
	};
}

//-----------------------------------------------------------------
//
var CLOUD_WIDTH = 40;
var CLOUD_HWIDTH = CLOUD_WIDTH / 2;
var CLOUD_HEIGHT = 30;
var CLOUD_HHEIGHT = CLOUD_HEIGHT / 2;
var CLOUD_MIN_RADIUS = 5;
var CLOUD_RADIUS = 15;
var CLOUD_COLOR_VARIANCE = 8;
var CLOUD_COLOR_RANGE = 60;
var CLOUD_MIN_SPEED = 5;
var CLOUD_SPEED = 20;
var CLOUD_SIZE = 2;
var CLOUD_MIN_SIZE = 2;
var CLOUD_LIGHTNING_LENGTH = 1.2; //secs
var CLOUD_LIGHTNING_DIST = 150; //pix

function Cloud() {
	this.rand();
}

Cloud.prototype.bbWidth = function() {
	return this.s * CLOUD_WIDTH;
}

Cloud.prototype.bbHeight= function() {
	return this.s * CLOUD_HEIGHT;
}

Cloud.prototype.rand = function() {
	this.s = r(CLOUD_SIZE) + CLOUD_MIN_SIZE;
	this.x = r(w + 2 * this.bbWidth()) - this.bbWidth();
	this.y = r(h + 2 * this.bbHeight()) - this.bbHeight();
	this.p = Array();
	for (var i = 0; i < 5; i++) {
		this.p[i] = {
			x: (r(CLOUD_WIDTH) - CLOUD_HWIDTH) * this.s,
			y: (r(CLOUD_HEIGHT) - CLOUD_HHEIGHT) * this.s,
			r: (r(CLOUD_MIN_RADIUS) + CLOUD_RADIUS) * this.s,
			c: r(CLOUD_COLOR_VARIANCE) 
		};
	}
	this.c = r(CLOUD_COLOR_RANGE);
	this.dx = r(CLOUD_SPEED) + CLOUD_MIN_SPEED;
	this.t = millis();
}

Cloud.prototype.update = function() {
	var dt = m - this.t;
	this.t += dt; 
	this.x += this.dx * (dt / 1000);	
	if (this.x > w + this.bbWidth()) {
		this.rand();
		this.x = -this.bbWidth();
	}
}

Cloud.prototype.draw = function(weather) {
	for (var i = 0; i < this.p.length; i++) {
		q = this.p[i];
		var col = this.c + weather.c + q.c;
		var x = this.x + q.x;
		var y = this.y + q.y;
		var p = fisheye.project({x:x,y:y});
		x = p.x;
		y = p.y;
		var intensity = 0;
		for (var j = 0; j < weather.lightning.length; j++) {
			var l = weather.lightning[j];
			var lt = secs - l.t;
			if (lt < 0) continue;
			if (lt > CLOUD_LIGHTNING_LENGTH) continue;
			var d = dist(x-l.x, y-l.y);
			if (d > CLOUD_LIGHTNING_DIST) continue;
			intensity = Math.max(intensity, 1 - (d/(2*CLOUD_LIGHTNING_DIST)) - Math.abs(Math.sin(lt * 10 * Math.PI)/2));
		}
		col += (0xff - col) * intensity;
		col = parseInt(Math.min(0xff, col));
		col = (col << 16) | (col << 8) | (col);
		ctx.fillStyle = "#" + zeroPad(parseInt(col).toString(16), 6);
		ctx.beginPath();
		ctx.arc(x, y, q.r, 0, 2*Math.PI); 
		ctx.closePath();
		ctx.fill();
	}
}

//-----------------------------------------------------------------

var WEATHER_NUM_LIGHTNING = 3;

function Weather() {
	this.c = 0,
	this.lightning = [];
	this.t = 0;
	this.num = WEATHER_NUM_LIGHTNING;
}

Weather.prototype.getSkyColor = function() {
	var i = this.c / 0xff;
	var r = parseInt(0x82 * i);
	var g = parseInt(0xa2 * i);
	var b = parseInt(0xc6 * i);
	return "rgb("+r+", "+g+", "+b+")";
}

Weather.prototype.getColor = function() {
	return this.c;
}

Weather.prototype.setColor = function(c) {
	this.c = c;
}

Weather.prototype.getNumLightning = function() {
	return this.num;
}

Weather.prototype.setNumLightning = function(num) {
	this.num = num;
}

Weather.prototype.push = function() {
	this.t += r(2);
	this.lightning.push({
		x: r(w),
		y: r(h),
		t: this.t
	});
}

Weather.prototype.update = function() {
	var i = 0;
	while (i < this.lightning.length) {
		if (this.lightning[i].t + CLOUD_LIGHTNING_LENGTH < secs) {
			this.lightning.shift();
		} else {
			i++;
		}
	}
	while (this.lightning.length < parseInt(this.num)) {
		this.push();
	}
}


//-----------------------------------------------------------------

function FishEyeLens() {
	this.s = 0;	
}

FishEyeLens.prototype.getSize = function() {
	return this.s;
}

FishEyeLens.prototype.setSize = function(s) {
	this.s = s;
	this.update();
}

FishEyeLens.prototype.update = function() {
	this.x = w/2;
	this.y = h/2;
	this.r = Math.max(0.1, this.s*(Math.min(w,h)/2));
}

FishEyeLens.prototype.project = function(p) {
	pd = {
		x: p.x - this.x,
		y: p.y - this.y,
	};
	d = dist(pd.x, pd.y);
	if (d > this.r) return p;
	if (d < 1) return p; 
	s = Math.pow(this.r/d, 2/3);
	pd.x *= s;
	pd.y *= s;
	pd.x += this.x;
	pd.y += this.y;
	return pd;
}

//-----------------------------------------------------------------

function Effect(start, end, effector) {
	this.effector = effector;
	this.start = start;
	this.t = 0;
	if (isNaN(end)) {
		this.execute = this.executeForever;
	} else {
		this.execute = this.executeRange;
		this.end = end;
		this.length = end - start;
	}
}

Effect.prototype.executeForever = function() {
	if (secs < this.start) return;
	var t = secs - this.start;
	this.effector(t);
}

Effect.prototype.executeRange = function() {
	if (secs < this.start) return;
	if (secs > this.end) return;
	var t = (secs - this.start) / this.length;
	this.effector(t);
}

//-----------------------------------------------------------------

function Effects() {
	this.effects = [];
}

Effects.prototype.add = function(effect) {
	this.effects.push(effect);
}

Effects.prototype.fire = function() {
	for (var i = 0; i < this.effects.length; i++) {
		this.effects[i].execute();
	}
}

//-----------------------------------------------------------------

function Textor(lines) {
	this.lines = lines;
	this.lineSpacing = 1.2;
	this.total = 0;
	this.font = "Simpsons1";
}

Textor.prototype.add = function(line, size) {
	this.lines.push({
		l: line,
		s: size
	});
	this.updateTotal();
}

Textor.prototype.updateTotal = function() {
	this.total = 0;
	for (var i = 0; i < this.lines.length; i++) {
		this.total += this.lines[i].s * this.lineSpacing;
	}
}

Textor.prototype.draw = function() {
	this.updateTotal();
	ctx.textAlign = "center";
	ctx.textBaseline = "top";

	var scalar = h/100;

	var x = w/2;
	var y = h/2  - (scalar * this.total)/2;

	for (var i = 0; i < this.lines.length; i++) {	
		var l = this.lines[i];
		var ls = parseInt(scalar * l.s);
		ctx.font = ls + 'px "' + this.font + '"';
		ctx.fillText(l.l, x, y);
		y += this.lineSpacing * ls;
	};
}

function TextorEffect(start, end, lines, color) {
	var tlines = new Textor(lines);
	return new Effect(start, end, function(t) {
		var alpha = Math.pow(Math.sin(t*Math.PI),2/3);
		if (alpha > 1) alpha = 1;			
		ctx.globalAlpha = alpha;
		ctx.fillStyle = color;
		tlines.draw();
		ctx.globalAlpha = 1;
	});
}

//-----------------------------------------------------------------

// global state vars that are updated as we go
//
var w; // width of canvas
var h; // height of canvas
var t; // starting millis
var m; // millis of current frame
var c; // canvas
var ctx; // 2d context
var secs; // secs passed since start of invitation
var fisheye;

$(function(){
	c = $("#canvas")[0];
	ctx = c.getContext('2d'); 

	w = 0;
	h = 0;	
	
	// fisheye size
	var fs = 0;

	// logo
	var logo = loadimg("wl.png");

	// lens
	fisheye = new FishEyeLens();

	// array of pics
	var pics = Array();
	for (var i = 1; i < 15; i++) {
		pics[i-1] = loadimg("img/"+i+".jpg");
	}

	//audio
	if (typeof(Audio) != "undefined") {
		var thesimpsons = new Audio("thesimpsons.ogg");	
		thesimpsons.loop = true;
		var thunder = new Audio("thunder.ogg");	
		thunder.loop = false;
	} else {
		var thesimpsons = new FakeAudio();
		var thunder = new FakeAudio();
	}
	thesimpsons.playing = false;
	thunder.playing = false;

	var clickable = false;

	var clouds = Array();
	var weather = new Weather();

	initclouds = function() {
		for (var i = 0; i < 200; i++) {
			clouds[i] = new Cloud(ctx, r(w), r(h), 1 + r(2));
		}
	};
	
	updatesize = function() {
		if (c.width == window.innerWidth && c.height==window.innerHeight) return;
		c.width = window.innerWidth;
		c.height = window.innerHeight;
		w = c.width;
		h = c.height;
	};

	var effects = new Effects();

	effects.add(new Effect(0, NaN, function(t) {
		weather.update();
		fisheye.update();
	}));

	var picSpeed = 5;
	effects.add(new Effect(16, NaN, function(t) {
		var pic = pics[parseInt(t/picSpeed) % pics.length];
		var scale = Math.max(w / pic.width, h / pic.height);
		ctx.globalAlpha = Math.sin(((t / picSpeed) % 1) * Math.PI);
		var sw = pic.width * scale;
		var sh = pic.height * scale;
		ctx.drawImage(pic, (w-sw)/2, (h-sh)/2, sw, sh);
		ctx.globalAlpha = 1;
	}));

	effects.add(new Effect(0, NaN, function(t) {
		for (var i = 0; i < clouds.length; i++) {
			clouds[i].update();
			clouds[i].draw(weather);
		}
	}));

	effects.add(new Effect(16, 23, function(t) {
		fisheye.setSize(t/0.3);			
		weather.setNumLightning((1 - t) / 0.3);
		weather.setColor(0xff*t);
	}));

	effects.add(TextorEffect(3, 6, [
		{l:"After a long war...", s:10},
	],"#aaaaaa"));
	
	effects.add(TextorEffect(6, 9, [
		{l:"against evil bureaucrats...", s:10},
	],"#aaaaaa"));
	
	effects.add(TextorEffect(9, 12, [
		{l:"and indifferent,", s:10},
		{l:"and/or incompetent,", s:10},
	],"#aaaaaa"));

	effects.add(TextorEffect(12, 15, [
		{l:"or ju$t plain evil,", s:10},
		{l:"politicians...", s:10},
	],"#aaaaaa"));
	
	effects.add(TextorEffect(15, 18, [
		{l:"we can finally,", s:10},
		{l:"fire up the BBQ...", s:10},
	],"#aaaaaa"));
	
	effects.add(TextorEffect(18, 21, [
		{l:"and celebrate...", s:10},
	], "#ffffff"));
	
	var eoa = new Textor([
		{l:"the end of ACTA", s:10},
		{l:"BBQ at 19:00", s:10},
		{l:"Tarwestraat 33", s:10},
		{l:"9000 Gent", s:10},
	]);

	effects.add(new Effect(21, NaN, function(t) {
		var alpha = (secs - this.t) / 4;
		if (alpha > 1) alpha = 1;			
		ctx.globalAlpha = alpha;
		ctx.fillStyle = "#ffffff";
		eoa.draw();
		ctx.globalAlpha = 1;
	}));

	effects.add(new Effect(0, NaN, function(t) {
		if (thunder.playing) return;
		thunder.playing = true;
		thunder.play();
	}));

	effects.add(new Effect(13, NaN, function(t) {
		if (thesimpsons.playing) return;
		thesimpsons.playing = true;
		thesimpsons.play();
	}));

	draw = function() {
		updatesize();
		ctx.fillStyle = weather.getSkyColor();
		ctx.fillRect(0,0,w,h);
		m = millis();
		secs = (m - t) / 1000;
		ctx.globalAlpha = 1;

		effects.fire();
		setTimeout("draw()", 30);
	};

	t = millis();

	updatesize();
	initclouds();
	draw();	
});
