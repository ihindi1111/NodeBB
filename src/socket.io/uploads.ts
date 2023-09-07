import socketUser from './user';
import socketGroup from './groups';
import image from '../image';
import meta from '../meta';

interface Uploads {
    upload: (socket: { uid: string; id: string }, data: {
        chunk: string;
        params: {
            method: 'user.uploadCroppedPicture' | 'user.updateCover' | 'groups.cover.update';
            size: number;
            imageData: string;
        }
    }) => Promise<any>;
    clear: (sid: string) => void;
}

const inProgress: { [key: string]: { [key: string]: { imageData: string } } } = {};

// Define types for the functions in methodToFunc
type UploadFunction = (socket: { uid: string; id: string }, params: {
    size: number;
    imageData: string;
}) => Promise<any>;

const methodToFunc: { [key: string]: UploadFunction } = {
    'user.uploadCroppedPicture': socketUser.uploadCroppedPicture,
    'user.updateCover': socketUser.updateCover,
    'groups.cover.update': socketGroup.cover.update,
};

const uploads: Uploads = {
    upload: async function (socket, data): Promise<any> {
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

    clear: function (sid): void {
        delete inProgress[sid];
    },
};

export = uploads;
