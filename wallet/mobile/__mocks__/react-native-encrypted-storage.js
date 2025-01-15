const storage = {};

const RNEncryptedStorage = {
    setItem: jest.fn((key, value) => {
        return new Promise((resolve) => {
            storage[key] = value;
            resolve(value);
        });
    }),
    getItem: jest.fn((key) => {
        return new Promise((resolve) => {
            resolve(storage[key]);
        });
    }),
    removeItem: jest.fn((key) => {
        return new Promise((resolve) => {
            delete storage[key];
            resolve();
        });
    }),
    getAllKeys: jest.fn(() => {
        return new Promise((resolve) => {
            resolve(Object.keys(storage));
        });
    }),
    clear: jest.fn(() => {
        return new Promise((resolve) => {
            storage = {};
            resolve();
        });
    }),
};

export default RNEncryptedStorage;