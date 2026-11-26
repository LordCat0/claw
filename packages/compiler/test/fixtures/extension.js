Scratch.extensions.register({
  getInfo () {
    return {
      id: 'fixture',
      blocks: [{
        opcode: 'echo',
        blockType: Scratch.BlockType.REPORTER,
        text: 'echo [VALUE]',
        arguments: {
          VALUE: {
            type: Scratch.ArgumentType.STRING
          }
        }
      }]
    };
  },
  echo ({ VALUE }) {
    return VALUE;
  }
});
