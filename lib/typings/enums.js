"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PluginName = exports.PlatformType = exports.AutoPlay = exports.timeMultiPlier = exports.PlayerEvents = exports.SourceProviders = exports.LoopMode = exports.PlayerStates = exports.CacheType = void 0;
var CacheType;
(function (CacheType) {
    CacheType["Disk"] = "Disk";
    CacheType["Memory"] = "Memory";
})(CacheType = exports.CacheType || (exports.CacheType = {}));
var PlayerStates;
(function (PlayerStates) {
    PlayerStates["Idling"] = "Idling";
    PlayerStates["Playing"] = "Playing";
    PlayerStates["Paused"] = "Paused";
    PlayerStates["Destroyed"] = "Destroyed";
})(PlayerStates = exports.PlayerStates || (exports.PlayerStates = {}));
var LoopMode;
(function (LoopMode) {
    LoopMode["None"] = "none";
    LoopMode["Track"] = "song";
    LoopMode["Queue"] = "queue";
})(LoopMode = exports.LoopMode || (exports.LoopMode = {}));
var SourceProviders;
(function (SourceProviders) {
    SourceProviders[SourceProviders["Soundcloud"] = 0] = "Soundcloud";
    SourceProviders[SourceProviders["Twitch"] = 1] = "Twitch";
    SourceProviders[SourceProviders["LocalFile"] = 2] = "LocalFile";
    SourceProviders[SourceProviders["Attachment"] = 3] = "Attachment";
})(SourceProviders = exports.SourceProviders || (exports.SourceProviders = {}));
var PlayerEvents;
(function (PlayerEvents) {
    PlayerEvents["TRACK_START"] = "trackStart";
    PlayerEvents["AUDIO_ERROR"] = "audioError";
    PlayerEvents["TRACK_END"] = "trackEnd";
    PlayerEvents["QUEUE_START"] = "queueStart";
    PlayerEvents["QUEUE_END"] = "queueEnd";
    PlayerEvents["TRACK_PAUSE"] = "trackPause";
    PlayerEvents["TRACK_RESUME"] = "trackResume";
})(PlayerEvents = exports.PlayerEvents || (exports.PlayerEvents = {}));
exports.timeMultiPlier = [1, 60, 60, 24];
var AutoPlay;
(function (AutoPlay) {
    AutoPlay["None"] = "none";
    AutoPlay["Youtube"] = "youtube";
    AutoPlay["SoundCloud"] = "soundcloud";
    AutoPlay["Spotify"] = "spotify";
    AutoPlay["Relative"] = "relative";
})(AutoPlay = exports.AutoPlay || (exports.AutoPlay = {}));
var PlatformType;
(function (PlatformType) {
    PlatformType[PlatformType["SoundCloud"] = 0] = "SoundCloud";
    PlatformType[PlatformType["LocalFile"] = 1] = "LocalFile";
    PlatformType[PlatformType["Url"] = 2] = "Url";
    PlatformType[PlatformType["Youtube"] = 3] = "Youtube";
    PlatformType[PlatformType["Spotify"] = 4] = "Spotify";
})(PlatformType = exports.PlatformType || (exports.PlatformType = {}));
var PluginName;
(function (PluginName) {
    PluginName["Cacher"] = "cache";
    PluginName["Filter"] = "filter";
})(PluginName = exports.PluginName || (exports.PluginName = {}));
//# sourceMappingURL=enums.js.map