// types mapping
const typeMap = {
    uint8: { size: 1, getter: 'getUint8', setter: 'setUint8' },
    uint32: { size: 4, getter: 'getUint32', setter: 'setUint32' },
    float32: { size: 4, getter: 'getFloat32', setter: 'setFloat32' },
};

// Генератор структур: принимает описание полей и типов, возвращает функции кодирования и декодирования
function createStructMethods(structDef) {
    const fields = Object.entries(structDef);

    // вычисляем offsets и размер структуры
    let size = 0;
    const offsets = {};
    for (const [name, type] of fields) {
        offsets[name] = size;
        size += typeMap[type].size;
    }

    function encode(obj) {
        const buffer = new ArrayBuffer(size);
        const view = new DataView(buffer);
        for (const [name, type] of fields) {
            const val = obj[name] ?? 0;
            view[typeMap[type].setter](offsets[name], val, true);
        }
        return buffer;
    }

    function decode(buffer) {
        const view = new DataView(buffer);
        const obj = {};
        for (const [name, type] of fields) {
            obj[name] = view[typeMap[type].getter](offsets[name], true);
        }
        return obj;
    }

    return { size, encode, decode };
}

// -----------------------------
// Определяем структуры
// -----------------------------

// Command: type=0, cmd=[0-connect,1-disconnect,2-ping], id:uint32
const CommandStruct = { type: 'uint8', cmd: 'uint8', id: 'uint32' };
const Command = createStructMethods(CommandStruct);

// Placement: type=1, id:uint32, x,y,z,rot_x,rot_y,rot_z:float32
const PlacementStruct = {
    type: 'uint8',
    id: 'uint32',
    x: 'float32',
    y: 'float32',
    z: 'float32',
    rot_x: 'float32',
    rot_y: 'float32',
    rot_z: 'float32',
};
const Placement = createStructMethods(PlacementStruct);

// -----------------------------
// Вспомогательные функции
// -----------------------------

function serializeCommand(id, cmd) {
    return Command.encode({ type: 0, cmd, id });
}

function deserializeCommand(buffer) {
    const obj = Command.decode(buffer);
    if (obj.type !== 0) return null;
    return obj;
}

function serializePlacement(obj) {
    return Placement.encode({ type: 1, ...obj });
}

function deserializePlacements(buffer) {
    const arr = [];
    const structSize = Placement.size;
    for (
        let offset = 0;
        offset + structSize <= buffer.byteLength;
        offset += structSize
    ) {
        const slice = buffer.slice(offset, offset + structSize);
        const p = Placement.decode(slice);
        if (p.type === 1) arr.push(p);
    }
    return arr;
}

// -----------------------------
// Константы
// -----------------------------
const MessageType = { COMMAND: 0, PLACEMENT: 1 };
const CommandID = { CONNECT: 0, DISCONNECT: 1, PING: 2 };

// Экспорт для app.js
// Если используешь через <script> в браузере, можно привязать к window
window.serializeCommand = serializeCommand;
window.deserializeCommand = deserializeCommand;
window.serializePlacement = serializePlacement;
window.deserializePlacements = deserializePlacements;
window.MessageType = MessageType;
window.CommandID = CommandID;
