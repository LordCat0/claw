const newSprite = (opts) => ({
    isStage: opts.isStage ?? false,
    name: opts.name, // Required
    variables: opts.variables ?? {},
    lists: opts.lists ?? {},
    broadcasts: opts.broadcasts ?? {},
    blocks: opts.blocks ?? {},
    comments: opts.comments ?? {},
    currentCostume: opts.currentCostume ?? 0,
    costumes: opts.costumes ?? [{
        name: '_empty',
        bitmapResolution: 1,
        dataFormat: 'svg',
        assetId: '927d672925e7b99f7813735c484c6922',
        md5ext: '927d672925e7b99f7813735c484c6922.svg',
        rotationCenterX: 30.74937882782359,
        rotationCenterY: 58.864768144346826
    }],
    sounds: opts.sounds ?? [],
    volume: opts.volume ?? 100,
    layerOrder: opts.isStage ? 0 : 1,
    tempo: opts.tempo ?? 60,
    videoTransparency: opts.videoTransparency ?? 50,
    videoState: opts.videoState ?? 'on',
    textToSpeechLanguage: opts.textToSpeechLanguage ?? null
});

const newBlock = (opts) => ({
    opcode: opts.opcode, // Required
    next: opts.next ?? null,
    parent: opts.parent ?? null,
    inputs: opts.inputs ?? {},
    fields: opts.fields ?? {},
    shadow: opts.shadow ?? false,
    topLevel: opts.topLevel ?? false,
    ...({mutation: opts.mutation} ?? {}),
    x: opts.x ?? 0,
    y: opts.y ?? 0
});

module.exports = {
    newSprite,
    newBlock
};