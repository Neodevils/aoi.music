"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SourceProviders = exports.LoopMode = exports.PlayerStates = exports.CacheType = void 0;
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
//# sourceMappingURL=constants.js.map