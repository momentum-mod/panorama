// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck - Disables TS for entire file; moved some of this to TS then gave up,
// really don't care until we work on learn more.

// also cba with namespacing nicely
const LEARN_FILE_PATH_EVIL_DONT_USE = 'panorama/data/learn.vdf';

// Spreadsheet URL to use if loading in -dev
const DATA_URL_EVIL_DONT_USE =
	'https://docs.google.com/spreadsheets/d/e/2PACX-1vTlH08v-dqtGl49T0Eslb56o-Y-xp6kOwhEo4Bwx387AxbpGHFw7AUBeBQMQdwEBI9g4gBBnGmUZ5EW/pub?output=csv';

// Old stuff from gamemodes.js before integrating website repo-based data.
// Don't want to think about learn UI til post 0.10.0!
const GameModeEvilDoNotUse = {
	SURF: 1,
	BHOP: 2,
	CLIMB: 3,
	RJ: 4,
	SJ: 5,
	AHOP: 7,
	CONC: 9,
	DEFRAG: 10
};

const GameModeInfo = {
	[GameModeEvilDoNotUse.SURF]: {
		idName: 'Surf',
		name: '#Gamemode_Surf',
		shortName: '#Gamemode_Surf_Short',
		prefix: 'surf_'
	},
	[GameModeEvilDoNotUse.BHOP]: {
		idName: 'Bhop',
		name: '#Gamemode_Bhop',
		shortName: '#Gamemode_Bhop_Short',
		prefix: 'bhop_'
	},
	[GameModeEvilDoNotUse.CLIMB]: {
		idName: 'Climb',
		name: '#Gamemode_Climb',
		shortName: '#Gamemode_Climb_Short',
		prefix: 'climb_'
	},
	[GameModeEvilDoNotUse.RJ]: {
		idName: 'RJ',
		name: '#Gamemode_RJ',
		shortName: '#Gamemode_RJ_Short',
		prefix: 'rj_'
	},
	[GameModeEvilDoNotUse.SJ]: {
		idName: 'SJ',
		name: '#Gamemode_SJ',
		shortName: '#Gamemode_SJ_Short',
		prefix: 'sj_'
	},
	[GameModeEvilDoNotUse.AHOP]: {
		idName: 'Ahop',
		name: '#Gamemode_Ahop',
		shortName: '#Gamemode_Ahop_Short',
		prefix: 'ahop_'
	},
	[GameModeEvilDoNotUse.CONC]: {
		idName: 'Conc',
		name: '#Gamemode_Conc',
		shortName: '#Gamemode_Conc_Short',
		prefix: 'conc_'
	},
	[GameModeEvilDoNotUse.DEFRAG]: {
		idName: 'Defrag',
		name: '#Gamemode_Defrag',
		shortName: '#Gamemode_Defrag_Short',
		prefix: 'df_'
	}
};

class Learn {
	static readonly panels = {
		listContainer: $<Panel>('#LearnListContainer'),
		refreshButton: $<Button>('#RefreshButton'),
		rightPanel: $<Panel>('#RightPanel'),
		completionStatus: $<Label>('#LessonCompletionStatus'),
		guide: $<Panel>('#Guide')
	};

	static activeMode: any;
	static currentLessonData: any;

	static lessonData: any = {};
	static modes: any = {};
	static {
		// Create modes obj in form { [GameMode.SURF]: { button: ..., list: ... } }
		for (const modeData of Object.values(GameModeInfo)) {
			this.modes[modeData.idName] = {
				button: $(`#${modeData.idName}Radio`),
				list: $.CreatePanel('Panel', this.panels.listContainer, `${modeData.idName}List`, {
					class: 'learn-list'
				})
			};

			this.lessonData[modeData.idName] = {};
		}
	}

	static async onLoad() {
		UiToolkitAPI.ShowGenericPopup(
			'Learn Section - Very early alpha!',
			'Welcome to the beginnings of the Learn section!\n\n' +
				"This is in an early testing phase, with each mode's maps at differing levels of completion.\n\n" +
				"They'll be being updated regularly through Steam updates, so make sure to check back in every now and then!\n\n" +
				"Feedback is GREATLY appreciated, especially if you're brand new to a mode, so be sure to let us know your thoughts in the new learn channels in the Discord.\n\n" +
				'So, expect some jank, but have fun! ♥',
			'wide-popup'
		);

		if (GameInterfaceAPI.GetSettingBool('developer')) {
			await this.loadFromGoogleSheet().catch((error) => {
				this.updateSpinnerStatus('Error, see console!');

				$.Warning(`Failed to retrieve learn data: ${error}`);
			});
		} else {
			this.loadFromKVFile();
			this.panels.refreshButton.AddClass('hide');
			this.initLearnPanels();
		}

		const savedMode = $.persistentStorage.getItem('learn.selectedMode');
		this.setSelectedMode(savedMode ?? 'Surf');
	}

	static initLearnPanels() {
		for (const [modeName, modeData] of Object.entries(this.modes)) {
			modeData.list.RemoveAndDeleteChildren(); // This can be removed after the live refresh functionality is removed

			if (!this.lessonData[modeName]) continue;

			// Get all the unique difficulty sections strings
			const difficultyNames = [
				...new Set(Object.values(this.lessonData[modeName]).map((lesson) => lesson['Difficulty']))
			];

			// Make the section panel and collect into obj for each string and collect into sections obj
			const sections = {};
			for (const difficulty of difficultyNames) {
				const section = $.CreatePanel('Panel', modeData.list, `${modeName}${difficulty}`);

				section.LoadLayoutSnippet('learn-list-section');
				section.SetDialogVariable('learn_section_header', difficulty);

				sections[difficulty] = section;
			}

			// Populate with entries
			for (const [lessonKey, lessonData] of Object.entries(this.lessonData[modeName])) {
				const panel = $.CreatePanel('RadioButton', sections[lessonData['Difficulty']], lessonKey, {
					group: `${modeName}LearnButtons`
				});

				panel.LoadLayoutSnippet('learn-list-lesson');
				panel.SetDialogVariable('learn_lesson_name', lessonData['Name']);
				panel.SetPanelEvent('onactivate', () => this.setSelectedLesson(modeName, lessonKey));
				panel.SetPanelEvent('ondblclick', () => {
					this.setSelectedLesson(modeName, lessonKey);
					this.startCurrentLesson();
				});
				panel.FindChild('CompletionIcon').AddClass('learn-list__completion-icon--hidden'); // We can do these in the future
			}

			for (const section of Object.values(sections) as any[])
				for (const [i, child] of section.Children().entries())
					if (child.paneltype === 'RadioButton')
						child.AddClass(`learn-list__lesson--${i % 2 === 0 ? 'even' : 'odd'}`);
		}
	}

	static setSelectedLesson(mode, lessonID) {
		const lessonData = this.lessonData[mode][lessonID];

		if (!lessonData) this.clearSelectedLesson();

		this.panels.rightPanel.RemoveClass('learn__right--hidden');

		// this.panels.completionStatus.AddClass('learn__completion-status--complete');

		this.panels.guide.SetHasClass('learn-guide--hidden', !lessonData['Guide']);

		$.GetContextPanel().SetDialogVariable('selected_lesson_title', lessonData['Name']);
		$.GetContextPanel().SetDialogVariable('selected_lesson_description', lessonData['Description']);
		$.GetContextPanel().SetDialogVariable('selected_lesson_guide', lessonData['Guide']);

		this.currentLessonData = lessonData;
	}

	static startCurrentLesson() {
		if (!this.currentLessonData) return;

		if (!this.currentLessonData['Map']) {
			$.Warning(`Learn: No map specified for lesson ${this.currentLessonData['Name']}`);
			return;
		}

		if (MapCacheAPI.GetMapName() !== this.currentLessonData['Map']) {
			this.launchMapThenTeleport();
		} else {
			this.teleportToLessonStart();
		}
	}

	static launchMapThenTeleport() {
		const onMapLoad = () => {
			$.UnregisterForUnhandledEvent('LevelInitPostEntity', onLoadHandle);

			if (MapCacheAPI.GetMapName() !== this.currentLessonData['Map'])
				$.Warning(
					`Learn: This is not the right map... we meant to load ${
						this.currentLessonData['Map']
					}, got ${MapCacheAPI.GetMapName()}!`
				);
			else this.teleportToLessonStart();
		};

		const onLoadHandle = $.RegisterForUnhandledEvent('LevelInitPostEntity', onMapLoad);

		const map = this.currentLessonData['Map'];

		$.Msg(`Learn: Launching map ${map}`);

		GameInterfaceAPI.ConsoleCommand(`map ${map}`);
	}

	static teleportToLessonStart() {
		if (!GameInterfaceAPI.GetSettingBool('sv_cheats')) {
			// For some reason SetSettingBool errors here
			GameInterfaceAPI.ConsoleCommand('sv_cheats 1');
		}

		if (this.currentLessonData['TeleTarget']) {
			const target = this.currentLessonData['TeleTarget'];
			GameInterfaceAPI.ConsoleCommand(`ent_fire teleport_send_player addoutput "target ${target}"`);
			$.Schedule(0.05, () => GameInterfaceAPI.ConsoleCommand('mom_restart_track'));
			$.Msg(`Learn: Teleporting to TeleTarget ${target}`);
		} else if (this.currentLessonData['Position']) {
			const pos = this.currentLessonData['Position'];
			const angles = this.currentLessonData['Angle'] ?? '0 0 0';
			GameInterfaceAPI.ConsoleCommand(`setpos ${pos}`);
			GameInterfaceAPI.ConsoleCommand(`setang ${angles}`);
			$.Msg(`Learn: Teleporting to Position ${pos}, Angles ${angles} `);
		} else {
			$.Warning(
				`Learn: Error loading lesson ${this.currentLessonData['Name']}, both teleport target and position were unspecified!`
			);
			return;
		}
	}

	static clearSelectedLesson() {
		this.panels.rightPanel.AddClass('learn__right--hidden');
	}

	static setSelectedMode(mode) {
		$.DispatchEvent('Activated', this.modes[mode].button, 'mouse');
	}

	static onModeButtonPressed(mode) {
		if (!mode || !this.modes[mode] || mode === this.activeMode) return;

		this.modes[this.activeMode]?.list.RemoveClass('learn-list--active');
		this.modes[mode].list.AddClass('learn-list--active');

		this.activeMode = mode;
		$.persistentStorage.setItem('learn.selectedMode', mode);

		this.clearSelectedLesson();
	}

	static loadFromKVFile() {
		this.lessonData = $.LoadKeyValuesFile(LEARN_FILE_PATH_EVIL_DONT_USE);
	}

	// Everything below here can be removed after we're done with loading from sheet

	static async loadFromGoogleSheet() {
		this.panels.refreshButton.Children()[0].AddClass('spin-clockwise');
		UiToolkitAPI.ShowTextTooltip(this.panels.refreshButton.id, 'Quering the Google Sheet...');

		const data = await this.getSheetData();

		this.updateSpinnerStatus('Retrieved successfully!');

		const dataArray = Papa.parse(data, {
			header: true,
			dynamicTyping: true
		}).data;

		for (const mode of Object.keys(this.modes))
			for (const [index, lesson] of dataArray.filter((lesson) => lesson['Mode'] === mode).entries())
				this.lessonData[mode] = {
					...this.lessonData[mode],
					[mode + (index + 1)]: lesson
				};

		this.initLearnPanels();
	}

	static updateSpinnerStatus(tooltipString) {
		this.panels.refreshButton.Children()[0].RemoveClass('spin-clockwise');
		UiToolkitAPI.ShowTextTooltip(this.panels.refreshButton.id, tooltipString);
		$.Schedule(1, () => UiToolkitAPI.HideTextTooltip());
	}

	static getSheetData() {
		return new Promise((resolve, reject) => {
			$.AsyncWebRequest(DATA_URL_EVIL_DONT_USE, {
				type: 'GET',
				complete: (data) =>
					data.statusText === 'success' ? resolve(data.responseText) : reject(data.statusText)
			});
		});
	}
}

/* TEMPORARY CSV to JSON parser whilst we work on this from the spreadsheet
	Papa Parse
	v5.3.1
	https://github.com/mholt/PapaParse
	License: MIT
*/
// prettier-ignore
// eslint-disable-next-line
!function(e,t){"function"==typeof define&&define.amd?define([],t):"object"==typeof module&&"undefined"!=typeof exports?module.exports=t():e.Papa=t()}(this,function s(){"use strict";var f="undefined"!=typeof self?self:"undefined"!=typeof window?window:void 0!==f?f:{};var n=!f.document&&!!f.postMessage,o=n&&/blob:/i.test((f.location||{}).protocol),a={},h=0,b={parse:function(e,t){var i=(t=t||{}).dynamicTyping||!1;M(i)&&(t.dynamicTypingFunction=i,i={});if(t.dynamicTyping=i,t.transform=!!M(t.transform)&&t.transform,t.worker&&b.WORKERS_SUPPORTED){var r=function(){if(!b.WORKERS_SUPPORTED)return!1;var e=(i=f.URL||f.webkitURL||null,r=s.toString(),b.BLOB_URL||(b.BLOB_URL=i.createObjectURL(new Blob(["(",r,")();"],{type:"text/javascript"})))),t=new f.Worker(e);var i,r;return t.onmessage=_,t.id=h++,a[t.id]=t}();return r.userStep=t.step,r.userChunk=t.chunk,r.userComplete=t.complete,r.userError=t.error,t.step=M(t.step),t.chunk=M(t.chunk),t.complete=M(t.complete),t.error=M(t.error),delete t.worker,void r.postMessage({input:e,config:t,workerId:r.id})}var n=null;b.NODE_STREAM_INPUT,"string"==typeof e?n=t.download?new l(t):new p(t):!0===e.readable&&M(e.read)&&M(e.on)?n=new g(t):(f.File&&e instanceof File||e instanceof Object)&&(n=new c(t));return n.stream(e)},unparse:function(e,t){var n=!1,_=!0,m=",",y="\r\n",s='"',a=s+s,i=!1,r=null,o=!1;!function(){if("object"!=typeof t)return;"string"!=typeof t.delimiter||b.BAD_DELIMITERS.filter(function(e){return-1!==t.delimiter.indexOf(e)}).length||(m=t.delimiter);("boolean"==typeof t.quotes||"function"==typeof t.quotes||Array.isArray(t.quotes))&&(n=t.quotes);"boolean"!=typeof t.skipEmptyLines&&"string"!=typeof t.skipEmptyLines||(i=t.skipEmptyLines);"string"==typeof t.newline&&(y=t.newline);"string"==typeof t.quoteChar&&(s=t.quoteChar);"boolean"==typeof t.header&&(_=t.header);if(Array.isArray(t.columns)){if(t.columns.length === 0)throw new Error("Option columns is empty");r=t.columns}void 0!==t.escapeChar&&(a=t.escapeChar+s);"boolean"==typeof t.escapeFormulae&&(o=t.escapeFormulae)}();var h=new RegExp(j(s),"g");"string"==typeof e&&(e=JSON.parse(e));if(Array.isArray(e)){if(e.length === 0||Array.isArray(e[0]))return u(null,e,i);if("object"==typeof e[0])return u(r||Object.keys(e[0]),e,i)}else if("object"==typeof e)return"string"==typeof e.data&&(e.data=JSON.parse(e.data)),Array.isArray(e.data)&&(e.fields||(e.fields=e.meta&&e.meta.fields),e.fields||(e.fields=Array.isArray(e.data[0])?e.fields:"object"==typeof e.data[0]?Object.keys(e.data[0]):[]),Array.isArray(e.data[0])||"object"==typeof e.data[0]||(e.data=[e.data])),u(e.fields||[],e.data||[],i);throw new Error("Unable to serialize unrecognized input");function u(e,t,i){var r="";"string"==typeof e&&(e=JSON.parse(e)),"string"==typeof t&&(t=JSON.parse(t));var n=Array.isArray(e)&&e.length > 0,s=!Array.isArray(t[0]);if(n&&_){for(var a=0;a<e.length;a++)0<a&&(r+=m),r+=v(e[a],a);t.length > 0&&(r+=y)}for(var o=0;o<t.length;o++){var h=n?e.length:t[o].length,u=!1,f=n?Object.keys(t[o]).length === 0:t[o].length === 0;if(i&&!n&&(u="greedy"===i?""===t[o].join("").trim():1===t[o].length&&t[o][0].length === 0),"greedy"===i&&n){for(var d=[],l=0;l<h;l++){var c=s?e[l]:l;d.push(t[o][c])}u=""===d.join("").trim()}if(!u){for(var p=0;p<h;p++){0<p&&!f&&(r+=m);var g=n&&s?e[p]:p;r+=v(t[o][g],p)}o<t.length-1&&(!i||0<h&&!f)&&(r+=y)}}return r}function v(e,t){if(undefined==e)return"";if(e.constructor===Date)return JSON.stringify(e).slice(1,25);!0===o&&"string"==typeof e&&null!==e.match(/^[+=@\-].*$/)&&(e="'"+e);var i=e.toString().replace(h,a),r="boolean"==typeof n&&n||"function"==typeof n&&n(e,t)||Array.isArray(n)&&n[t]||function(e,t){for(var i=0;i<t.length;i++)if(-1<e.indexOf(t[i]))return!0;return!1}(i,b.BAD_DELIMITERS)||-1<i.indexOf(m)||" "===i.charAt(0)||" "===i.charAt(i.length-1);return r?s+i+s:i}}};if(b.RECORD_SEP=String.fromCharCode(30),b.UNIT_SEP=String.fromCharCode(31),b.BYTE_ORDER_MARK="\uFEFF",b.BAD_DELIMITERS=["\r","\n",'"',b.BYTE_ORDER_MARK],b.WORKERS_SUPPORTED=!n&&!!f.Worker,b.NODE_STREAM_INPUT=1,b.LocalChunkSize=10485760,b.RemoteChunkSize=5242880,b.DefaultDelimiter=",",b.Parser=E,b.ParserHandle=i,b.NetworkStreamer=l,b.FileStreamer=c,b.StringStreamer=p,b.ReadableStreamStreamer=g,f.jQuery){var d=f.jQuery;d.fn.parse=function(o){var i=o.config||{},h=[];return this.each(function(e){if(!("INPUT"===d(this).prop("tagName").toUpperCase()&&"file"===d(this).attr("type").toLowerCase()&&f.FileReader)||!this.files||this.files.length === 0)return!0;for(var t=0;t<this.files.length;t++)h.push({file:this.files[t],inputElem:this,instanceConfig:d.extend({},i)})}),e(),this;function e(){if(h.length > 0){var e,t,i,r,n=h[0];if(M(o.before)){var s=o.before(n.file,n.inputElem);if("object"==typeof s){if("abort"===s.action)return e="AbortError",t=n.file,i=n.inputElem,r=s.reason,void(M(o.error)&&o.error({name:e},t,i,r));if("skip"===s.action)return void u();"object"==typeof s.config&&(n.instanceConfig=d.extend(n.instanceConfig,s.config))}else if("skip"===s)return void u()}var a=n.instanceConfig.complete;n.instanceConfig.complete=function(e){M(a)&&a(e,n.file,n.inputElem),u()},b.parse(n.file,n.instanceConfig)}else M(o.complete)&&o.complete()}function u(){h.splice(0,1),e()}}}function u(e){this._handle=null,this._finished=!1,this._completed=!1,this._halted=!1,this._input=null,this._baseIndex=0,this._partialLine="",this._rowCount=0,this._start=0,this._nextChunk=null,this.isFirstChunk=!0,this._completeResults={data:[],errors:[],meta:{}},function(e){var t=w(e);t.chunkSize=Number.parseInt(t.chunkSize),e.step||e.chunk||(t.chunkSize=null);this._handle=new i(t),(this._handle.streamer=this)._config=t}.call(this,e),this.parseChunk=function(e,t){if(this.isFirstChunk&&M(this._config.beforeFirstChunk)){var i=this._config.beforeFirstChunk(e);void 0!==i&&(e=i)}this.isFirstChunk=!1,this._halted=!1;var r=this._partialLine+e;this._partialLine="";var n=this._handle.parse(r,this._baseIndex,!this._finished);if(!this._handle.paused()&&!this._handle.aborted()){var s=n.meta.cursor;this._finished||(this._partialLine=r.slice(Math.max(0, s-this._baseIndex)),this._baseIndex=s),n&&n.data&&(this._rowCount+=n.data.length);var a=this._finished||this._config.preview&&this._rowCount>=this._config.preview;if(o)f.postMessage({results:n,workerId:b.WORKER_ID,finished:a});else if(M(this._config.chunk)&&!t){if(this._config.chunk(n,this._handle),this._handle.paused()||this._handle.aborted())return void(this._halted=!0);n=void 0,this._completeResults=void 0}return this._config.step||this._config.chunk||(this._completeResults.data=this._completeResults.data.concat(n.data),this._completeResults.errors=this._completeResults.errors.concat(n.errors),this._completeResults.meta=n.meta),this._completed||!a||!M(this._config.complete)||n&&n.meta.aborted||(this._config.complete(this._completeResults,this._input),this._completed=!0),a||n&&n.meta.paused||this._nextChunk(),n}this._halted=!0},this._sendError=function(e){M(this._config.error)?this._config.error(e):o&&this._config.error&&f.postMessage({workerId:b.WORKER_ID,error:e,finished:!1})}}function l(e){var r;(e=e||{}).chunkSize||(e.chunkSize=b.RemoteChunkSize),u.call(this,e),this._nextChunk=n?function(){this._readChunk(),this._chunkLoaded()}:function(){this._readChunk()},this.stream=function(e){this._input=e,this._nextChunk()},this._readChunk=function(){if(this._finished)this._chunkLoaded();else{if(r=new XMLHttpRequest,this._config.withCredentials&&(r.withCredentials=this._config.withCredentials),n||(r.addEventListener('load', v(this._chunkLoaded,this)),r.onerror=v(this._chunkError,this)),r.open(this._config.downloadRequestBody?"POST":"GET",this._input,!n),this._config.downloadRequestHeaders){var e=this._config.downloadRequestHeaders;for(var t in e)r.setRequestHeader(t,e[t])}if(this._config.chunkSize){var i=this._start+this._config.chunkSize-1;r.setRequestHeader("Range","bytes="+this._start+"-"+i)}try{r.send(this._config.downloadRequestBody)}catch(error){this._chunkError(error.message)}n&&0===r.status&&this._chunkError()}},this._chunkLoaded=function(){4===r.readyState&&(r.status<200||400<=r.status?this._chunkError():(this._start+=this._config.chunkSize?this._config.chunkSize:r.responseText.length,this._finished=!this._config.chunkSize||this._start>=function(e){var t=e.getResponseHeader("Content-Range");if(null===t)return-1;return Number.parseInt(t.slice(Math.max(0, t.lastIndexOf("/")+1)))}(r),this.parseChunk(r.responseText)))},this._chunkError=function(e){var t=r.statusText||e;this._sendError(new Error(t))}}function c(e){var r,n;(e=e||{}).chunkSize||(e.chunkSize=b.LocalChunkSize),u.call(this,e);var s="undefined"!=typeof FileReader;this.stream=function(e){this._input=e,n=e.slice||e.webkitSlice||e.mozSlice,s?((r=new FileReader).addEventListener('load', v(this._chunkLoaded,this)),r.onerror=v(this._chunkError,this)):r=new FileReaderSync,this._nextChunk()},this._nextChunk=function(){this._finished||this._config.preview&&!(this._rowCount<this._config.preview)||this._readChunk()},this._readChunk=function(){var e=this._input;if(this._config.chunkSize){var t=Math.min(this._start+this._config.chunkSize,this._input.size);e=n.call(e,this._start,t)}var i=r.readAsText(e,this._config.encoding);s||this._chunkLoaded({target:{result:i}})},this._chunkLoaded=function(e){this._start+=this._config.chunkSize,this._finished=!this._config.chunkSize||this._start>=this._input.size,this.parseChunk(e.target.result)},this._chunkError=function(){this._sendError(r.error)}}function p(e){var i;u.call(this,e=e||{}),this.stream=function(e){return i=e,this._nextChunk()},this._nextChunk=function(){if(!this._finished){var e,t=this._config.chunkSize;return t?(e=i.slice(0,Math.max(0, t)),i=i.slice(Math.max(0, t))):(e=i,i=""),this._finished=!i,this.parseChunk(e)}}}function g(e){u.call(this,e=e||{});var t=[],i=!0,r=!1;this.pause=function(){Reflect.apply(u.prototype.pause, this, arguments),this._input.pause()},this.resume=function(){Reflect.apply(u.prototype.resume, this, arguments),this._input.resume()},this.stream=function(e){this._input=e,this._input.on("data",this._streamData),this._input.on("end",this._streamEnd),this._input.on("error",this._streamError)},this._checkIsFinished=function(){r&&1===t.length&&(this._finished=!0)},this._nextChunk=function(){this._checkIsFinished(),t.length > 0?this.parseChunk(t.shift()):i=!0},this._streamData=v(function(e){try{t.push("string"==typeof e?e:e.toString(this._config.encoding)),i&&(i=!1,this._checkIsFinished(),this.parseChunk(t.shift()))}catch(error){this._streamError(error)}},this),this._streamError=v(function(e){this._streamCleanUp(),this._sendError(e)},this),this._streamEnd=v(function(){this._streamCleanUp(),r=!0,this._streamData("")},this),this._streamCleanUp=v(function(){this._input.removeListener("data",this._streamData),this._input.removeListener("end",this._streamEnd),this._input.removeListener("error",this._streamError)},this)}function i(m){var a,o,h,r=Math.pow(2,53),n=-r,s=/^\s*-?(\d+\.?|\.\d+|\d+\.\d+)([Ee][+-]?\d+)?\s*$/,u=/^(\d{4}-[01]\d-[0-3]\dT[0-2](?:\d:[0-5]){2}\d\.\d+([+-][0-2]\d:[0-5]\d|Z))|(\d{4}-[01]\d-[0-3]\dT[0-2](?:\d:[0-5]){2}\d([+-][0-2]\d:[0-5]\d|Z))|(\d{4}-[01]\d-[0-3]\dT[0-2]\d:[0-5]\d([+-][0-2]\d:[0-5]\d|Z))$/,t=this,i=0,f=0,d=!1,e=!1,l=[],c={data:[],errors:[],meta:{}};if(M(m.step)){var p=m.step;m.step=function(e){if(c=e,_())g();else{if(g(),c.data.length === 0)return;i+=e.data.length,m.preview&&i>m.preview?o.abort():(c.data=c.data[0],p(c,t))}}}function y(e){return"greedy"===m.skipEmptyLines?""===e.join("").trim():1===e.length&&e[0].length === 0}function g(){if(c&&h&&(k("Delimiter","UndetectableDelimiter","Unable to auto-detect delimiting character; defaulted to '"+b.DefaultDelimiter+"'"),h=!1),m.skipEmptyLines)for(var e=0;e<c.data.length;e++)y(c.data[e])&&c.data.splice(e--,1);return _()&&function(){if(!c)return;function e(e,t){M(m.transformHeader)&&(e=m.transformHeader(e,t)),l.push(e)}if(Array.isArray(c.data[0])){for(var t=0;_()&&t<c.data.length;t++)c.data[t].forEach(e);c.data.splice(0,1)}else c.data.forEach(e)}(),function(){if(!c||!m.header&&!m.dynamicTyping&&!m.transform)return c;function e(e,t){var i,r=m.header?{}:[];for(i=0;i<e.length;i++){var n=i,s=e[i];m.header&&(n=i>=l.length?"__parsed_extra":l[i]),m.transform&&(s=m.transform(s,n)),s=v(n,s),"__parsed_extra"===n?(r[n]=r[n]||[],r[n].push(s)):r[n]=s}return m.header&&(i>l.length?k("FieldMismatch","TooManyFields","Too many fields: expected "+l.length+" fields but parsed "+i,f+t):i<l.length&&k("FieldMismatch","TooFewFields","Too few fields: expected "+l.length+" fields but parsed "+i,f+t)),r}var t=1;c.data.length === 0||Array.isArray(c.data[0])?(c.data=c.data.map(e),t=c.data.length):c.data=e(c.data,0);m.header&&c.meta&&(c.meta.fields=l);return f+=t,c}()}function _(){return m.header&&l.length === 0}function v(e,t){return i=e,m.dynamicTypingFunction&&void 0===m.dynamicTyping[i]&&(m.dynamicTyping[i]=m.dynamicTypingFunction(i)),!0===(m.dynamicTyping[i]||m.dynamicTyping)?"true"===t||"TRUE"===t||"false"!==t&&"FALSE"!==t&&(function(e){if(s.test(e)){var t=Number.parseFloat(e);if(n<t&&t<r)return!0}return!1}(t)?Number.parseFloat(t):u.test(t)?new Date(t):""===t?null:t):t;var i}function k(e,t,i,r){var n={type:e,code:t,message:i};void 0!==r&&(n.row=r),c.errors.push(n)}this.parse=function(e,t,i){var r=m.quoteChar||'"';if(m.newline||(m.newline=function(e,t){e=e.slice(0,1048576);var i=new RegExp(j(t)+"([^]*?)"+j(t),"gm"),r=(e=e.replace(i,"")).split("\r"),n=e.split("\n"),s=1<n.length&&n[0].length<r[0].length;if(1===r.length||s)return"\n";for(var a=0,o=0;o<r.length;o++)"\n"===r[o][0]&&a++;return a>=r.length/2?"\r\n":"\r"}(e,r)),h=!1,m.delimiter)M(m.delimiter)&&(m.delimiter=m.delimiter(e),c.meta.delimiter=m.delimiter);else{var n=function(e,t,i,r,n){var s,a,o,h;n=n||[",","\t","|",";",b.RECORD_SEP,b.UNIT_SEP];for(var f of n){var d=0,l=0,c=0;o=void 0;for(var p=new E({comments:r,delimiter:f,newline:t,preview:10}).parse(e),g=0;g<p.data.length;g++)if(i&&y(p.data[g]))c++;else{var _=p.data[g].length;l+=_,void 0!==o?0<_&&(d+=Math.abs(_-o),o=_):o=_}p.data.length > 0&&(l/=p.data.length-c),(void 0===a||d<=a)&&(void 0===h||h<l)&&1.99<l&&(a=d,s=f,h=l)}return{successful:!!(m.delimiter=s),bestDelimiter:s}}(e,m.newline,m.skipEmptyLines,m.comments,m.delimitersToGuess);n.successful?m.delimiter=n.bestDelimiter:(h=!0,m.delimiter=b.DefaultDelimiter),c.meta.delimiter=m.delimiter}var s=w(m);return m.preview&&m.header&&s.preview++,a=e,o=new E(s),c=o.parse(a,t,i),g(),d?{meta:{paused:!0}}:c||{meta:{paused:!1}}},this.paused=function(){return d},this.pause=function(){d=!0,o.abort(),a=M(m.chunk)?"":a.slice(Math.max(0, o.getCharIndex()))},this.resume=function(){t.streamer._halted?(d=!1,t.streamer.parseChunk(a,!0)):setTimeout(t.resume,3)},this.aborted=function(){return e},this.abort=function(){e=!0,o.abort(),c.meta.aborted=!0,M(m.complete)&&m.complete(c),a=""}}function j(e){return e.replace(/[$()*+.?[\\\]^{|}]/g,"\\$&")}function E(e){var S,O=(e=e||{}).delimiter,x=e.newline,I=e.comments,T=e.step,D=e.preview,A=e.fastMode,L=S=void 0===e.quoteChar?'"':e.quoteChar;if(void 0!==e.escapeChar&&(L=e.escapeChar),("string"!=typeof O||-1<b.BAD_DELIMITERS.indexOf(O))&&(O=","),I===O)throw new Error("Comment character same as delimiter");!0===I?I="#":("string"!=typeof I||-1<b.BAD_DELIMITERS.indexOf(I))&&(I=!1),"\n"!==x&&"\r"!==x&&"\r\n"!==x&&(x="\n");var F=0,z=!1;this.parse=function(r,t,i){if("string"!=typeof r)throw new Error("Input must be a string");var n=r.length,e=O.length,s=x.length,a=I.length,o=M(T),h=[],u=[],f=[],d=F=0;if(!r)return C();if(A||!1!==A&&-1===r.indexOf(S)){for(var l=r.split(x),c=0;c<l.length;c++){if(f=l[c],F+=f.length,c!==l.length-1)F+=x.length;else if(i)return C();if(!I||f.slice(0,Math.max(0, a))!==I){if(o){if(h=[],k(f.split(O)),R(),z)return C()}else k(f.split(O));if(D&&D<=c)return h=h.slice(0,D),C(!0)}}return C()}for(var p=r.indexOf(O,F),g=r.indexOf(x,F),_=new RegExp(j(L)+j(S),"g"),m=r.indexOf(S,F);;)if(r[F]!==S)if(I&&f.length === 0&&r.substring(F,F+a)===I){if(-1===g)return C();F=g+s,g=r.indexOf(x,F),p=r.indexOf(O,F)}else if(-1!==p&&(p<g||-1===g))f.push(r.substring(F,p)),F=p+e,p=r.indexOf(O,F);else{if(-1===g)break;if(f.push(r.substring(F,g)),w(g+s),o&&(R(),z))return C();if(D&&h.length>=D)return C(!0)}else for(m=F,F++;;){if(-1===(m=r.indexOf(S,m+1)))return i||u.push({type:"Quotes",code:"MissingQuotes",message:"Quoted field unterminated",row:h.length,index:F}),E();if(m===n-1)return E(r.substring(F,m).replace(_,S));if(S!==L||r[m+1]!==L){if(S===L||0===m||r[m-1]!==L){-1!==p&&p<m+1&&(p=r.indexOf(O,m+1)),-1!==g&&g<m+1&&(g=r.indexOf(x,m+1));var y=b(-1===g?p:Math.min(p,g));if(r[m+1+y]===O){f.push(r.substring(F,m).replace(_,S)),r[F=m+1+y+e]!==S&&(m=r.indexOf(S,F)),p=r.indexOf(O,F),g=r.indexOf(x,F);break}var v=b(g);if(r.substring(m+1+v,m+1+v+s)===x){if(f.push(r.substring(F,m).replace(_,S)),w(m+1+v+s),p=r.indexOf(O,F),m=r.indexOf(S,F),o&&(R(),z))return C();if(D&&h.length>=D)return C(!0);break}u.push({type:"Quotes",code:"InvalidQuotes",message:"Trailing quote on quoted field is malformed",row:h.length,index:F}),m++}}else m++}return E();function k(e){h.push(e),d=F}function b(e){var t=0;if(-1!==e){var i=r.substring(m+1,e);i&&""===i.trim()&&(t=i.length)}return t}function E(e){return i||(void 0===e&&(e=r.slice(Math.max(0, F))),f.push(e),F=n,k(f),o&&R()),C()}function w(e){F=e,k(f),f=[],g=r.indexOf(x,F)}function C(e){return{data:h,errors:u,meta:{delimiter:O,linebreak:x,aborted:z,truncated:!!e,cursor:d+(t||0)}}}function R(){T(C()),h=[],u=[]}},this.abort=function(){z=!0},this.getCharIndex=function(){return F}}function _(e){var t=e.data,i=a[t.workerId],r=!1;if(t.error)i.userError(t.error,t.file);else if(t.results&&t.results.data){var n={abort:function(){r=!0,m(t.workerId,{data:[],errors:[],meta:{aborted:!0}})},pause:y,resume:y};if(M(i.userStep)){for(var s=0;s<t.results.data.length&&(i.userStep({data:t.results.data[s],errors:t.results.errors,meta:t.results.meta},n),!r);s++);delete t.results}else M(i.userChunk)&&(i.userChunk(t.results,n,t.file),delete t.results)}t.finished&&!r&&m(t.workerId,t.results)}function m(e,t){var i=a[e];M(i.userComplete)&&i.userComplete(t),i.terminate(),delete a[e]}function y(){throw new Error("Not implemented.")}function w(e){if("object"!=typeof e||null===e)return e;var t=Array.isArray(e)?[]:{};for(var i in e)t[i]=w(e[i]);return t}function v(e,t){return function(){e.apply(t,arguments)}}function M(e){return"function"==typeof e}return o&&(f.onmessage=function(e){var t=e.data;void 0===b.WORKER_ID&&t&&(b.WORKER_ID=t.workerId);if("string"==typeof t.input)f.postMessage({workerId:b.WORKER_ID,results:b.parse(t.input,t.config),finished:!0});else if(f.File&&t.input instanceof File||t.input instanceof Object){var i=b.parse(t.input,t.config);i&&f.postMessage({workerId:b.WORKER_ID,results:i,finished:!0})}}),(l.prototype=Object.create(u.prototype)).constructor=l,(c.prototype=Object.create(u.prototype)).constructor=c,(p.prototype=Object.create(p.prototype)).constructor=p,(g.prototype=Object.create(u.prototype)).constructor=g,b});
