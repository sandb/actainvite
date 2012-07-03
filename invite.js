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

		var intensity = 0;
		for (var j = 0; j < weather.lightning.length; j++) {
			var l = weather.lightning[j];
			var lt = secs - l.t;
			if (lt < 0) continue;
			if (lt > CLOUD_LIGHTNING_LENGTH) continue;
			var d = dist(x-l.x, y-l.y);
			if (d > CLOUD_LIGHTNING_DIST) continue;
			//intensity = Math.max(intensity, 1 - ((d/CLOUD_LIGHTNING_DIST) * (lt/CLOUD_LIGHTNING_LENGTH) * Math.sin(lt * 10 * Math.PI) * (i % 1.8)));
			console.log(1 - (d/(2*CLOUD_LIGHTNING_DIST)) - (Math.sin(lt * 10 * Math.PI)/2));
			intensity = Math.max(intensity, 1 - (d/(2*CLOUD_LIGHTNING_DIST)) - (Math.sin(lt * 10 * Math.PI)/2));
		}
		col += (0xff - col) * intensity;

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
	this.c = 0x22,
	this.lightning = [];
	this.t = 0;
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
	while (this.lightning.length < WEATHER_NUM_LIGHTNING) {
		this.push();
	}
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

$(function(){
	c = $("#canvas")[0];
	ctx = c.getContext('2d'); 

	w = 0;
	h = 0;	
	
	// fisheye size
	var fs = 0;

	// logo
	var logo = loadimg("wl.png");

	// array of pics
	var pics = Array();
	for (var i = 0; i < 15; i++) {
		pics[i] = loadimg("img/"+i+".jpg");
	}

	//audio
	if (typeof(Audio) != "undefined") {
		var aw = new Audio("aw.ogg");	
		aw.loop = true;
	} else {
		var aw = new FakeAudio();
	}
	aw.playing = false;

	var clickable = false;

	var clouds = Array();
	var weather = new Weather();

	initclouds = function() {
		for (var i = 0; i < 200; i++) {
			clouds[i] = new Cloud(ctx, r(w), r(h), 1 + r(2));
		}
	};
	
	fisheye = function(q, center) {
		qd = {
			x: q.x - center.x,
			y: q.y - center.y,
			r: q.r,
			c: q.c,
			xd: q.xd,
			yd: q.yd,
		};
		d = Math.sqrt(qd.x * qd.x + qd.y * qd.y);
		if (d > fs) return q;
		if (d < 1) return q; 
		s = Math.pow(fs/d, 2/3);
		qd.x *= s;
		qd.y *= s;
		qd.x += center.x;
		qd.y += center.y;
		return qd;
	};

	updatesize = function() {
		if (c.width == window.innerWidth && c.height==window.innerHeight) return;
		c.width = window.innerWidth;
		c.height = window.innerHeight;
		w = c.width;
		h = c.height;
	};
	
	draw = function() {
		updatesize();
		//ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
		ctx.fillStyle = "#22222a";
		ctx.fillRect(0,0,w,h);
		m = millis();
		secs = (m - t) / 1000;
		ctx.globalAlpha = 1;

		weather.update();

		for (var i = 0; i < clouds.length; i++) {
			clouds[i].update();
			clouds[i].draw(weather);
		}
		/*
		if (secs < 20) {
			ctx.globalCompositeOperation = "source-over";
			fs = secs * 100;
			for (var i = 0; i < p.length; i++) {
				q = fisheye(p[i], {x:w/2, y:h/2});
				ctx.fillStyle = q.c;
				ctx.beginPath();
				ctx.arc(q.x, q.y, q.r, 0, 2*Math.PI); 
				ctx.closePath();
				ctx.fill();
			}
			updatepoints();
		}
		if (logo.loaded) {
			ctx.globalCompositeOperation = "xor";
			var scale = 20 - secs;
			if (scale < 1) scale = 1;
			var hw = logo.width * scale / 2;
			var hh = logo.height * scale / 2;
			ctx.drawImage(logo, w/2 - hw, h/2 - hh, 2*hw, 2*hh);
		}
		if (secs > 20 && !clickable) {
			clickable = true;
			$("#canvas").click(function() {
				window.location="http://0x20.be/FrackFest_is_a_feature";
			});
			$("#canvas").css('cursor', 'pointer');
		}
		if (secs > 20) {
			ctx.globalCompositeOperation = "xor";
			var pic = pics[parseInt(secs/2) % pics.length];
			var scale = w / pic.width;
			scale *= 1 + secs % 2;
			var sw = pic.width * scale;
			var sh = pic.height * scale;
			ctx.drawImage(pic, (w-sw)/2, (h-sh)/2, sw, sh);
		}
		if (secs > 20) {
			var alpha = 1-((23-secs)/3);
			if (alpha > 1) alpha = 1;			
			ctx.globalAlpha = alpha;
			ctx.globalCompositeOperation = "source-over";
			ctx.fillStyle = "#333333";
			ctx.textAlign = "center";
			var x = w/2;
			var y = h/2 + 200;
			ctx.font='40px "VideoPhreak"';
			ctx.fillText("That's not a bug, that's a feature!", x, y);
			y += 40;
			ctx.font='28px "VideoPhreak"';
			ctx.fillText("Friday, 29th of June 2012, Whitespace.", x, y);
			y += 30;
			ctx.font='22px "VideoPhreak"';
			ctx.fillText("You *are* invited. Resistance *is* futile.", x, y);
			y += 24;
			ctx.font='16px "VideoPhreak"';
			ctx.fillText("Coded by sandb.", x, y);
		}
		if (secs > 30) {
			ctx.globalCompositeOperation = "source-over";
			fs = (10 + Math.abs(((secs - 30) % 20) - 10)) * 100;
			for (var i = 0; i < p.length; i++) {
				q = fisheye(p[i], {x:w/2, y:h/2});
				ctx.fillStyle = q.c;
				ctx.beginPath();
				ctx.arc(q.x, q.y, q.r, 0, 2*Math.PI); 
				ctx.closePath();
				ctx.fill();
			}
			updatepoints();
		}
		if (secs > 4 && !aw.playing) {
			aw.playing = true;
			aw.play();
		}
		//set final composition mode for buffer swapping
		ctx.globalCompositeOperation = "source-over";
		*/
		setTimeout("draw()", 30);
	};

	t = millis();

	updatesize();
	initclouds();
	draw();	
});
