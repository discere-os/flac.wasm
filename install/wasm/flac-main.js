// Mock FLAC module for testing structure
const mockFunctions = {
  cwrap: (name, returnType, argTypes) => {
    return (...args) => {
      console.log(`Mock ${name} called with args:`, args);
      if (name.includes('new')) return 12345; // Mock pointer
      if (name.includes('process') || name.includes('init')) return 1; // Success
      return 0;
    };
  },
  _malloc: (size) => {
    console.log(`Mock malloc: ${size} bytes`);
    return 0x1000; // Mock pointer
  },
  _free: (ptr) => {
    console.log(`Mock free: ${ptr}`);
  },
  HEAPU8: {
    buffer: new ArrayBuffer(1024 * 1024),
    set: (data, offset) => {
      console.log(`Mock HEAPU8.set: ${data.length} bytes at ${offset}`);
    }
  }
};

const FLACModule = () => Promise.resolve(mockFunctions);
FLACModule.default = FLACModule;

export default FLACModule;