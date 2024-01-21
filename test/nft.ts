import { expect } from "chai";
import { ethers, upgrades, network } from "hardhat";

describe("NFT", function () {
  const localRPC = "http://localhost:8545";
  const localMnemonic =
    "coyote news rib observe almost hub mimic scissors guitar order increase angry";

  const remoteRPC = "http://localhost:8575";
  const remoteMnemonic =
    "inherit bone warfare differ proof kind what wool install kite act renew";

  let remoteProvider;
  let localProvider;
  let localSigner;
  let remoteSigner;

  let localValidator;
  let remoteValidator;

  let localGateway;
  let remoteGateway;

  let localNFTProxy;
  let remoteNFTProxy;

  const _dstGastLimit = 1000000;
  const gasLimit = 1000000;
  const LOCAL_CHAIN_ID: string = "1";
  const REMOTE_CHAIN_ID: string = "2";

  const CHAIN_TYPE: number = 1;
  const POWERS = [4294967295];
  const VALSET_NONCE: number = 1;
  const ROUTER_BRIDGE_ADDRESS =
    "router10emt4hxmeyr8mjxayyt8huelzd7fpntmly8vus5puelqde6kn8xqcqa30g";
  const RELAYER_ROUTER_ADDRESS =
    "router1hrpna9v7vs3stzyd4z3xf00676kf78zpe2u5ksvljswn2vnjp3ys8kpdc7";

  // function getProxyFactory(signer) {
  //   return ethers.getContractFactory(
  //     ERC1967Proxy.abi,
  //     ERC1967Proxy.bytecode,
  //     signer
  //   );
  // }

  // const deployProxy = async (signer) => {
  //   const ProxyFactory = await getProxyFactory(signer);
  //   const proxyDeployment = Object.assign(
  //     { kind },
  //     await deploy(ProxyFactory, impl, data)
  //   );
  // };

  before(async () => {
    const payload =
      "0x000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000a00000000000000000000000004e27128cdef7a3cffdf800be3be6ee74639cb6390000000000000000000000004e27128cdef7a3cffdf800be3be6ee74639cb63900000000000000000000000000000000000000000000000000000000000000e0000000000000000000000000000000000000000000000000000000000000000355524900000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000014fd16e48426e22ac5ef9b8d4b6c917efc5f33e8c6343331313352b4e351f7ee00";

    this.timeout(1000000000);
    localProvider = new ethers.providers.JsonRpcProvider(localRPC);
    remoteProvider = new ethers.providers.JsonRpcProvider(remoteRPC);

    localSigner = ethers.Wallet.fromMnemonic(
      localMnemonic,
      "m/44'/60'/0'/0/0"
    ).connect(localProvider);
    remoteSigner = ethers.Wallet.fromMnemonic(
      remoteMnemonic,
      "m/44'/60'/0'/0/0"
    ).connect(remoteProvider);

    localValidator = ethers.Wallet.fromMnemonic(
      localMnemonic,
      "m/44'/60'/0'/0/1"
    ).connect(localProvider);
    remoteValidator = ethers.Wallet.fromMnemonic(
      remoteMnemonic,
      "m/44'/60'/0'/0/1"
    ).connect(remoteProvider);

    // let's deploy gateway contract on both chain

    const LOCAL_VALIDATORS = [localValidator.address];
    const Gateway = await ethers.getContractFactory("GatewayUpgradeable");
    localGateway = await Gateway.connect(localSigner).deploy();
    localGateway.initialize(
      LOCAL_CHAIN_ID,
      CHAIN_TYPE,
      LOCAL_VALIDATORS,
      POWERS,
      VALSET_NONCE
    );
    // const OutBoundCase = await ethers.getContractFactory("OutBoundCase");
    // const outBoundCase = await OutBoundCase.deploy(gateway.address);

    const REMOTE_VALIDATORS = [remoteValidator.address];
    remoteGateway = await Gateway.connect(remoteSigner).deploy();
    remoteGateway.initialize(
      REMOTE_CHAIN_ID,
      CHAIN_TYPE,
      REMOTE_VALIDATORS,
      POWERS,
      VALSET_NONCE
    );
    const NFT = await ethers.getContractFactory("NFT");

    let ok = await upgrades.deployProxy(await NFT, [
      remoteGateway.address,
      _dstGastLimit,
      remoteSigner,
    ]);
    await ok.deployed();

    await ok.ko(payload);

    return;
    localNFTProxy = await upgrades.deployProxy(
      await NFT.connect(localSigner),
      [localGateway.address, _dstGastLimit, localSigner],
      {
        timeout: 100000000000,
        pollingInterval: 10000,
        useDeployedImplementation: false,
      }
    );
    await localNFTProxy.connect(localSigner).deployed();
    expect(await localNFTProxy.gatewayContract()).to.be.equals(
      localGateway.address
    );

    remoteNFTProxy = await upgrades.deployProxy(
      await NFT.connect(remoteSigner),
      [remoteGateway.address, _dstGastLimit, remoteSigner],
      {
        timeout: 100000000000,

        pollingInterval: 10000,
        useDeployedImplementation: false,
      }
    );
    await remoteNFTProxy.deployed();

    expect(await remoteNFTProxy.gatewayContract()).to.be.equals(
      remoteGateway.address
    );

    // console.log({
    //   con: localNFTProxy.provider.connection,
    //   add: localNFTProxy.address,
    //   t: "local",
    // });

    // console.log({
    //   con: remoteNFTProxy.provider.connection,
    //   add: remoteNFTProxy.address,
    //   t: "remote",
    // });

    // enroll remote
    await localNFTProxy.setContractOnChain(
      CHAIN_TYPE,
      REMOTE_CHAIN_ID,
      remoteNFTProxy.address,
      { gasLimit }
    );

    await remoteNFTProxy.setContractOnChain(
      CHAIN_TYPE,
      LOCAL_CHAIN_ID,
      localNFTProxy.address,
      { gasLimit }
    );
  });
  beforeEach(async function () {});

  it("gateway Setup and nft deployment to chains", () => {});

  it("Cross Chain NFT Transfer", async function () {
    return;
    // mint nft on local chain
    await localNFTProxy
      .connect(localSigner)
      .safeMint(localSigner.address, "URI", {
        value: 1, // 1wei
        gasLimit,
      });

    expect(await localNFTProxy.ownerOf(0)).to.be.equal(localSigner.address);

    const expiryDurationInSeconds = 0; // for infinity
    const destGasPrice = await remoteProvider.getGasPrice();
    const tx = await localNFTProxy
      .connect(localSigner)
      .transferNFTCrossChain(
        CHAIN_TYPE,
        REMOTE_CHAIN_ID,
        expiryDurationInSeconds,
        destGasPrice,
        localSigner.address,
        0,
        {
          gasPrice: await localProvider.getGasPrice(),
          gasLimit,
        }
      );

    // const ok = await tx.wait();
    // console.log(ok);
  });
});
