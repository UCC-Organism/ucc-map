var Color = require('pex-color').Color;
var Platform = require('pex-sys').Platform;

var Config = {
  editorRoomAlpha: 0.5,
  roomTypes: [
    { type: ''         , label: 'Other'    , color: '#999999', centerColor: '#999999', edgeColor: '#999999' },
    { type: 'classroom', label: 'Classroom', color: '#00FF00', centerColor: '#00FF00', edgeColor: '#00FF00' },
    { type: 'toilet'   , label: 'Toilet'   , color: '#0055DD', centerColor: '#0055DD', edgeColor: '#0055DD' },
    { type: 'research' , label: 'Research' , color: '#FF00FF', centerColor: '#FF00FF', edgeColor: '#FF00FF' },
    { type: 'admin'    , label: 'Admin'    , color: '#6666FF', centerColor: '#6666FF', edgeColor: '#6666FF' },
    { type: 'closet'   , label: 'Closet'   , color: '#996600', centerColor: '#996600', edgeColor: '#996600' },
    { type: 'food'     , label: 'Food'     , color: '#FFAA00', centerColor: '#FFAA00', edgeColor: '#FFAA00' },
    { type: 'knowledge', label: 'Knowledge', color: '#00DDAA', centerColor: '#00DDAA', edgeColor: '#00DDAA' },
    { type: 'exit'     , label: 'Exit'     , color: '#FF0000', centerColor: '#FF0000', edgeColor: '#FF0000' },
    { type: 'empty'    , label: 'Empty'    , color: '#000000', centerColor: '#000000', edgeColor: '#000000' },
    { type: 'cell'     , label: 'Cell'     , color: '#696E98', centerColor: '#696E98', edgeColor: '#FF00FF' } //green
  ],
  roomTypesByType: { }
};

Config.roomTypes.forEach(function(roomType) {
  Config.roomTypesByType[roomType.type] = roomType;
})

Config.roomTypes.forEach(function(roomType) {
  roomType.color = Color.fromHex(roomType.color);
  roomType.centerColor = Color.fromHex(roomType.centerColor);
  roomType.edgeColor = Color.fromHex(roomType.edgeColor);
});

Config.dataPath = Platform.isBrowser ? 'data' : __dirname + '/data';

module.exports = Config;