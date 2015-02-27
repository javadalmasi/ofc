window.app = angular.module( "wis", [ "ngMaterial", "aFilePicker" ] )
.run(["$rootScope", "$window", function($rootScope, $window){
	$rootScope.webp = $window.webp
}])
.service("storage", ["$window", function($window){
	var mod = "x";
	try {
		localStorage.setItem(mod, mod);
		localStorage.removeItem(mod);
		return $window.localStorage;
	} catch(e) {
		return {};
	}
}])
.controller('StatusCtrl', ['$http', '$timeout', '$mdDialog', function($http, $timeout, $mdDialog){
	var Status = this;
	var timedout = false;
	var timer = $timeout(function(){
		timedout = true;
	}, 10000);

	Status.stillChecking = true;
	$http.get("https://ofc.p.mashape.com/status", {
		timeout: timer,
		headers: {
			"X-Mashape-Key": "dFYPWXxpp3mshKD6Kimb4pVfvYLvp1YWcWfjsnErOY3HN8zs4a"
		}
	}).then(function(res){
		Status.res = res;
		Status.stillChecking = false;
	}, function(res){
		if(timedout) res.status = 408;
		Status.res = res;
		Status.stillChecking = false;
	});
}])
.controller("MainCtrl", ["$http", "$mdDialog", "storage", "$interval", "$mdToast", "aFilePicker", function($http, $mdDialog, storage, $interval, $mdToast, aFilePicker){
	var que = [],
		startTime;
		Main = this;

	function has(format){
		return storage[format]
	}

	Main.save = function(){
		var paths = {};

		var files = que.map(function(xhr){
			var cnd = xhr.getResponseHeader("Content-Disposition");
			var filename = cnd ? cnd.match(/filename="([^"\\]*(?:\\.[^"\\]*)*)"/i)[1] : "Error log - " + xhr.$name + ".json";
			var type = xhr.getResponseHeader("Content-Type");

			var fileExist = !!paths[filename];
			var fileType = filename.split('.').pop();
			var fileNumber = 1;

			while (fileExist) {

				var current = filename.substring(0, filename.lastIndexOf('.')) + ' (' + fileNumber + ').' + fileType;

				if (paths[current]) {
					fileNumber++;
				} else {
					filename = current;
					break;
				}
			}

			paths[filename] = true;

			return {
				relativePath: filename,
				type: type,
				name: filename,
				$arrayBuffer: xhr.response
			}

		});

		aFilePicker.save({files: files});
	}

	this.storage = storage

	this.reset = function(){
		Main.totalUploadSize =
		Main.totalDownloadSize =
		Main.totalDone =
		Main.totalUploaded =
		Main.totalDownloaded =
		Main.procentDone =
		Main.totalConverting = 0;
		Main.fonts = [];
		que = [];
	}

	this.set = function(format){
		!this.storage[format] && storage.removeItem(format);
		this.requierFormat = !this.formats.some(has);
	}

	this.toggle = function(font, collection){
		for(var v=storage[collection[0]],con=!0,ii=i=collection.length-1;(i--)>1&&con;con=!!storage[collection[i]]==!!storage[collection[i+1]]);

		if(font === "font-face" && con){
			for(ii++;ii--;storage[v ? 'setItem' : 'removeItem'](collection[ii], v));
		} else if (con && !!v && !storage[collection[1]]){
			storage.removeItem(collection[0]);
		}
	}

	this.pickerOpt = {
		services: ["myDevice", "link"],
		maxFiles: Infinity,
		maxFileSize: 26214400
	};

	this.fonts = [];
	this.formats = ['afm','bin','cff','dfont','eot','otf','pfa','pfb','pfm','ps','pt3','suit','svg','t42','tfm','ttc','ttf','ufo','woff','woff2','font-face'];
	this.requierFormat = !this.formats.some(has);

	this.addedFonts = function(){
		var wantedFormats = this.formats.filter(function(format){
			return storage.getItem(format) !== null
		}).join(",");

		this.fonts.forEach(function(font){

			font.getFile.start("Blob", 0, function(blob){
				UploadFile(blob, font.name, wantedFormats)
			});
		});


		var updater = $interval(function(){
			Main.totalUploadSize = 0;
			Main.totalDownloadSize = 0;
			Main.totalDone = 0;
			Main.totalUploaded = 0;
			Main.totalDownloaded = 0;
			Main.procentDone = 0;
			Main.totalConverting = 0;

			Main.procentUploaded = 0;
			Main.procentDownloaded = 0;

			que.forEach(function(xhr){
				Main.totalDone += xhr.readyState === 4 ? 1:0;

				if(xhr.$uploaded){
					Main.totalUploadSize += xhr.$uploaded.total;
					Main.totalUploaded += xhr.$uploaded.loaded;

					Main.procentDone += xhr.$uploaded.loaded / xhr.$uploaded.total / 2;
					Main.procentUploaded += xhr.$uploaded.loaded / xhr.$uploaded.total;

					if(xhr.$uploaded.loaded === xhr.$uploaded.total){
						Main.totalConverting += 1;
					}
				}


				if(xhr.$downloaded){
					Main.totalConverting -= 1;
					Main.totalDownloadSize += xhr.$downloaded.total;
					Main.totalDownloaded += xhr.$downloaded.loaded;

					Main.procentDone += xhr.$downloaded.loaded / xhr.$downloaded.total / 2;
					Main.procentDownloaded += xhr.$downloaded.loaded / xhr.$downloaded.total;
				}
			});

			Main.procentDone *= 100 / que.length;
			Main.procentUploaded *= 100 / que.length;
			Main.procentDownloaded *= 100 / que.length;

			if(Main.procentDone === 100){
				audio_new.play();
				$interval.cancel(updater);
			}

		}, 100);


	}

	function UploadFile(blob, name, wantedFormats) {
		var fd = new FormData();
		var xhr = new XMLHttpRequest();

		que.push(xhr);

		xhr.$name = name;

		fd.append("file", blob, name);
		fd.append("format", wantedFormats);
		fd.append("output", "zip");

		xhr.upload.addEventListener("progress", function(e) {
			xhr.$uploaded = e;
		}, false);

		xhr.addEventListener("progress", function(e) {
			xhr.$downloaded = e;
		}, false);

		xhr.onload = function(evt){
			if(xhr.status !== 200){
				var toast = $mdToast.simple()
					.content('Failed to convert \n'+name)
					.action('OK')
					.highlightAction(false)
					.hideDelay(0)
					.position("top right")

				$mdToast.show(toast);
			}
		}

		// start upload
		xhr.open("POST", "https://ofc.p.mashape.com/directConvert");
		xhr.setRequestHeader("X-Mashape-Key", "dFYPWXxpp3mshKD6Kimb4pVfvYLvp1YWcWfjsnErOY3HN8zs4a");
		xhr.responseType = "arraybuffer";
		xhr.send(fd);
	}

	// var elapsedTime = (new Date().getTime()) - startTime;
	// var chunksPerTime = currentChunk / elapsedTime;
	// var estimatedTotalTime = amountOfChunks / chunksPerTime;
	// var timeLeftInSeconds = (estimatedTotalTime - elapsedTime) / 1000;

	// var withOneDecimalPlace = Math.round(timeLeftInSeconds * 10) / 10;
}])
.controller('QnACtrl', ['$mdDialog', function($mdDialog){
	this.questions = [
		{
			title: "Why can't I convert my font?",
			answers: "It may be that the font is in a unknown format (or uses features that isn't supported, or is so badly corrupted as to be unreadable). It can also timeout if it dosen't respond with a single charachter within 30 secounds (mostly caused by large fonts over 500 Kib that is converted to woff2 due to complex algoritm to minimize smallest size)"
		},{
			title: "What format can I convert to/from?",
			answers: "You can convert to: afm bin cff dfont eot fon otf pfa pfb pfm ps pt3 suit svg t11 t42 tfm ttf ufo woff woff2... font-face is included if you have a paid subscription plan. Converting from an other format excludes UFO and font-face. But the glyph included in a PDF can also be converted to a font format"
		},{
			title: "Server - What mimetype should I use?",
			answers:
			".eot => application/vnd.ms-fontobject (as from December 2005)" +
			".otf => application/font-sfnt (as from March 2013)" +
			".svg => image/svg+xml (as from August 2011)" +
			".ttf => application/font-sfnt (as from March 2013)" +
			".woff => application/font-woff (as from January 2013)" +
			"woff2 => application/font-woff2\n\n" +

			"It's worth mentioning that you can gzip (or otherwise compress) all the above font formats except for woff and woff2, which is already compressed."
		}
	];
	this.open = function($event, question){
		$event.preventDefault();

		var confirm = $mdDialog.alert()
			.title(question.title)
			.content(question.answers)
			.ariaLabel('Answer dialog')
			.ok('Gotchya!')
			.targetEvent($event);

		confirm._options.parent = document.getElementById("QnA");

		$mdDialog.show(confirm).then(function(){
			$event.target.focus();
		})
	}
}])
.filter('filesize', function(){
	return function (size, cUnit){

		for(var i = 0, unit = 'Byte0KiB0MiB0GiB0TiB0PiB0EiB0ZiB0YiB'.split(0);
			1024 <= size; // While the size is smaller
			i++
		) size /= 1024;

		return size ? (size+.5|0) + (cUnit + "" === cUnit ? cUnit : ' ' + unit[i]) : '--' // jshint ignore:line
	};
});