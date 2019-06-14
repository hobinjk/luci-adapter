const fetch = require('node-fetch');

const {
  Adapter,
  Device,
} = require('gateway-addon');

class LuciDevice extends Device {
  /**
   * @param {LuciAdapter} adapter
   * @param {String} id - A globally unique identifier
   * @param {Object} config - the config info to use
   */
  constructor(adapter, id, config) {
    super(adapter, id);

    this.name = 'LuCI Router';
    this.description = `A router at ip ${config.ip}`;

    this['@context'] = 'https://iot.mozilla.org/schemas';
    this['@type'] = [];

    this.addAction('callRpc', {
      title: 'Call RPC',
      description: 'Call function',
      input: {
        type: 'object',
        required: ['library', 'method'],
        properties: {
          library: {
            type: 'string',
          },
          method: {
            type: 'string',
          },
        },
      },
    });

    this.rpcId = 1;
    this.config = config;

    this.authenticate();

    this.adapter.handleDeviceAdded(this);
  }

  url(path) {
    return `http://${this.config.ip}/cgi-bin/luci${path}`;
  }

  async authenticate() {
    const res = await this.callRpc(
      'auth', 'login',
      [this.config.username, this.config.password]);
    console.log(res.result);
    this.token = res.result;
  }

  async callRpc(library, method, params) {
    const id = this.rpcId;
    this.rpcId += 1;
    const res = await fetch(this.url(`/rpc/${library}`), {
      method: 'POST',
      body: JSON.stringify({
        id,
        method,
        params,
      }),
    });
    return await res.json();
  }

  async performAction(action) {
    action.start();

    if (action.name === 'callRpc') {
      await this.callRpc(action.input.library, action.input.method, []);
    }

    action.finish();
  }
}

/**
 * Luci adapter
 * Instantiates each configured LuCI device
 */
class LuciAdapter extends Adapter {
  constructor(adapterManager, manifest) {
    super(adapterManager, 'luci', manifest.name);
    this.manifest = manifest;

    adapterManager.addAdapter(this);
    this.addAllThings();
  }

  startPairing() {
    this.addAllThings();
  }

  async addAllThings() {
    for (const routerConf of this.manifest.moziot.config.routers) {
      console.log('routerConfig', routerConf);
      if (!routerConf.ip) {
        continue;
      }
      const id = `luci-${routerConf.ip.replace(/[^0-9a-zA-Z]/g, '-')}`;
      if (!this.devices[id]) {
        new LuciDevice(this, id, routerConf);
      }
    }
  }
}

module.exports = LuciAdapter;
