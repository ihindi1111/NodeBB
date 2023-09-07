// The next line calls a function in a module that has not been updated to TS yet
// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call

import * as socketUser from './user';
import * as socketGroup from './groups';
import * as image from '../image';
import * as meta from '../meta';

interface Uploads {
    upload: (socket: SocketType, data: DataType) => Promise<ResponseType>;
    clear: (sid: string) => void;
}

type SocketType = {
    uid: string;
    id: string;
};

type DataType = {
    chunk: string;
    params: {
        method: string;
        size: number;
        imageData: string;
    };
};

const inProgress: { [key: string]: any } = {};

interface MethodToFunc {
    [key: string]: (socket: SocketType, params: any) => Promise<ResponseType>;
}

const methodToFunc: MethodToFunc = {
    'user.uploadCroppedPicture': socketUser.uploadCroppedPicture,
    'user.updateCover': socketUser.updateCover,
    'groups.cover.update': socketGroup.cover.update,
};

const uploads: Uploads = {
    upload: async function (socket: any, data: any): Promise<any> {
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
                meta.config.maximumProfileImageSize : meta.config.maximumCoverImageSize;
            const size = image.sizeFromBase64(socketUploads[method].imageData);

            if (size > maxSize * 1024) {
                throw new Error(`[[error:file-too-big, ${maxSize}]]`);
            }
            if (socketUploads[method].imageData.length < data.params.size) {
                return;
            }
            data.params.imageData = socketUploads[method].imageData;
            const result = await methodToFunc[data.params.method](socket, data.params);
            delete socketUploads[method];
            return result;
        } catch (err) {
            delete inProgress[socket.id];
            throw err;
        }
    },

    clear: function (sid: string): void {
        delete inProgress[sid];
    },
};

export = uploads;