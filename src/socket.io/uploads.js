"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
const user_1 = __importDefault(require("./user"));
const groups_1 = __importDefault(require("./groups"));
const image_1 = __importDefault(require("../image"));
const meta_1 = __importDefault(require("../meta"));
const inProgress = {};
const uploads = {
    upload: function (socket, data) {
        return __awaiter(this, void 0, void 0, function* () {
            const methodToFunc = {
                'user.uploadCroppedPicture': user_1.default.uploadCroppedPicture,
                'user.updateCover': user_1.default.updateCover,
                'groups.cover.update': groups_1.default.cover.update,
            };
            if (!socket.uid || !data || !data.chunk ||
                !data.params || !data.params.method || !methodToFunc.hasOwnProperty(data.params.method)) {
                throw new Error('[[error:invalid-data]]');
            }
            inProgress[socket.id] = inProgress[socket.id] || Object.create(null);
            const socketUploads = inProgress[socket.id];
            const { method } = data.params;
            socketUploads[method] = socketUploads[method] || { imageData: '' };
            socketUploads[method].imageData += data.chunk;
            try {
                const maxSize = data.params.method === 'user.uploadCroppedPicture' ?
                    meta_1.default.config.maximumProfileImageSize : meta_1.default.config.maximumCoverImageSize;
                const size = image_1.default.sizeFromBase64(socketUploads[method].imageData);
                if (size > maxSize * 1024) {
                    throw new Error(`[[error:file-too-big, ${maxSize}]]`);
                }
                if (socketUploads[method].imageData.length < data.params.size) {
                    return;
                }
                data.params.imageData = socketUploads[method].imageData;
                const result = yield methodToFunc[data.params.method](socket, data.params);
                delete socketUploads[method];
                return result;
            }
            catch (err) {
                delete inProgress[socket.id];
                throw err;
            }
        });
    },
    clear: function (sid) {
        delete inProgress[sid];
    },
};
module.exports = uploads;
