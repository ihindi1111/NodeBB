import socketUser from './user';
import socketGroup from './groups';
import image from '../image';
import meta from '../meta';

type UploadFunction = (socket: { uid: string; id: string }, params: {
    size: number;
    imageData: string;
}) => Promise<unknown>;

const methodToFunc: { [key: string]: UploadFunction } = {
    'user.uploadCroppedPicture': socketUser.uploadCroppedPicture as UploadFunction,
    'user.updateCover': socketUser.updateCover as UploadFunction,
    'groups.cover.update': socketGroup.cover.update as UploadFunction,
};

interface Uploads {
    upload: (socket: { uid: string; id: string }, data: {
        params: {
            method: keyof typeof methodToFunc;
            size: number;
            imageData: string;
        };
        chunk: string; // Add the 'chunk' property here
    }) => Promise<unknown>;
    clear: (sid: string) => void;
}

const inProgress: { [key: string]: { [key: string]: { imageData: string } } } = {};

const uploads: Uploads = {
    upload: async function (socket, data) {
        if (!socket.uid || !data || !data.chunk ||
            !data.params || !data.params.method || !methodToFunc.hasOwnProperty(data.params.method)) {
            throw new Error('[[error:invalid-data]]');
        }

        const socketUploads = (inProgress[socket.id] || Object.create(null)) as
        { [key: string]: { imageData: string } };
        const { method } = data.params;

        socketUploads[method] = socketUploads[method] || { imageData: '' };
        socketUploads[method].imageData += data.chunk;

        try {
            const maxSize: number = data.params.method === 'user.uploadCroppedPicture' ?
                meta.config.maximumProfileImageSize : meta.config.maximumCoverImageSize;
            const size: number = image.sizeFromBase64(socketUploads[method].imageData);

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

    clear: function (sid): void {
        delete inProgress[sid];
    },
};

export = uploads;

