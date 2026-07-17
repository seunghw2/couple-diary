const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// phosphor-react-native의 `react-native` 진입점은 미컴파일 src/index.tsx라
// Metro가 ./icons/* 를 제대로 해석하지 못한다. 컴파일된 ESM 빌드로 우회.
const defaultResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'phosphor-react-native') {
    return context.resolveRequest(context, 'phosphor-react-native/lib/module/index.js', platform);
  }
  return (defaultResolveRequest ?? context.resolveRequest)(context, moduleName, platform);
};

module.exports = config;
