import chai, { expect } from "chai";
import { Contract, utils } from "ethers";
import { solidity } from "ethereum-waffle";
import { ethers } from "hardhat";
import { defaultAbiCoder } from "@ethersproject/abi";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { GatewayUpgradeable, GatewayUpgradeable__factory } from "../typechain";

chai.use(solidity);

const CHAIN_ID: string = "1";
const DEST_CHAIN_ID: string = "2";
const CHAIN_TYPE: number = 1;
const POWERS = [4294967295];
const VALSET_NONCE: number = 1;
const ROUTER_BRIDGE_ADDRESS =
  "router10emt4hxmeyr8mjxayyt8huelzd7fpntmly8vus5puelqde6kn8xqcqa30g";
const RELAYER_ROUTER_ADDRESS =
  "router1hrpna9v7vs3stzyd4z3xf00676kf78zpe2u5ksvljswn2vnjp3ys8kpdc7";
const REQ_FROM_SOURCE_METHOD_NAME =
  "0x7265717565737446726f6d536f75726365000000000000000000000000000000";
const CROSS_TALK_ACK_METHOD_NAME =
  "0x63726F737354616C6B41636B0000000000000000000000000000000000000000";

describe("Gateway Cross-Talk Testing", function () {
  let signatureUtils: Contract;
  let Gateway: GatewayUpgradeable__factory;
  let gateway: Contract;
  let signers: SignerWithAddress[];
  let VALIDATORS: string[];

  beforeEach(async () => {
    const SignatureUtils = await ethers.getContractFactory("SignatureUtils");
    signatureUtils = await SignatureUtils.deploy();

    signers = await ethers.getSigners();
    VALIDATORS = [signers[0].address];
    // const Gateway = await ethers.getContractFactory("GatewayUpgradeable", {
    //     libraries: {
    //         SignatureUtils: signatureUtils.address
    //     }
    // });
    Gateway = await ethers.getContractFactory("GatewayUpgradeable");
    gateway = await Gateway.deploy();
  });

  it("Should call Request To Destination Chain", async function () {
    await gateway.initialize(
      CHAIN_ID,
      CHAIN_TYPE,
      VALIDATORS,
      POWERS,
      VALSET_NONCE
    );
    await gateway.setBridgeFees(0, DEST_CHAIN_ID, "1000");
    await gateway.setBridgeFees(0, CHAIN_ID, "1000");

    var timestamp = 1681014199;
    var isAtomicCalls = false;
    var ackType = 2;
    var srcChainGasParams = {
      gasLimit: 0,
      gasPrice: 0,
    };
    var destChainParams = {
      gasLimit: 0,
      gasPrice: 0,
      destChainType: 0,
      destChainId: DEST_CHAIN_ID,
    };
    var ackGasParams = [0, 0];
    var srcChainParams = [1, timestamp, isAtomicCalls, CHAIN_TYPE, CHAIN_ID];
    var destChainParamsArray = [0, 0, 0, DEST_CHAIN_ID];
    var contractCalls = {
      payloads: ["0x000000"],
      destContractAddresses: ["0x5b38da6a701c568545dcfcb03fcb875f56beddc4"],
    };

    await expect(
      gateway.requestToDest(
        timestamp,
        isAtomicCalls,
        ackType,
        srcChainGasParams,
        destChainParams,
        contractCalls,
        {
          value: "1000",
          gasLimit: 10000000,
        }
      )
    )
      .to.emit(gateway, "RequestToDestEvent")
      .withArgs(
        VALIDATORS[0].toLowerCase(),
        2,
        srcChainParams,
        ackGasParams,
        destChainParamsArray,
        contractCalls.destContractAddresses,
        contractCalls.payloads,
        ackType,
        signers[0].address,
        false
      );

    var srcChainParams = [2, timestamp, isAtomicCalls, CHAIN_TYPE, CHAIN_ID];
    await expect(
      gateway.requestToDest(
        timestamp,
        isAtomicCalls,
        ackType,
        srcChainGasParams,
        destChainParams,
        contractCalls,
        { value: "1000" }
      )
    )
      .to.emit(gateway, "RequestToDestEvent")
      .withArgs(
        VALIDATORS[0].toLowerCase(),
        3,
        srcChainParams,
        ackGasParams,
        destChainParamsArray,
        contractCalls.destContractAddresses,
        contractCalls.payloads,
        ackType,
        signers[0].address,
        false
      );

    var destChainParams = {
      gasLimit: 0,
      gasPrice: 0,
      destChainType: 0,
      destChainId: CHAIN_ID,
    };
    var srcChainParams = [1, timestamp, isAtomicCalls, CHAIN_TYPE, CHAIN_ID];
    var destChainParamsArray = [0, 0, 0, CHAIN_ID];
    await expect(
      gateway.requestToDest(
        timestamp,
        isAtomicCalls,
        ackType,
        srcChainGasParams,
        destChainParams,
        contractCalls,
        { value: "1000" }
      )
    )
      .to.emit(gateway, "RequestToDestEvent")
      .withArgs(
        VALIDATORS[0].toLowerCase(),
        4,
        srcChainParams,
        ackGasParams,
        destChainParamsArray,
        contractCalls.destContractAddresses,
        contractCalls.payloads,
        ackType,
        signers[0].address,
        false
      );
  });

  it("Should fail as fees not set", async function () {
    await gateway.initialize(
      CHAIN_ID,
      CHAIN_TYPE,
      VALIDATORS,
      POWERS,
      VALSET_NONCE
    );

    var timestamp = 1681014199;
    var isAtomicCalls = false;
    var ackType = 2;
    var srcChainGasParams = {
      gasLimit: 0,
      gasPrice: 0,
    };
    var destChainParams = {
      gasLimit: 0,
      gasPrice: 0,
      destChainType: 0,
      destChainId: DEST_CHAIN_ID,
    };
    var contractCalls = {
      payloads: ["0x000000"],
      destContractAddresses: ["0x5b38da6a701c568545dcfcb03fcb875f56beddc4"],
    };

    await expect(
      gateway.requestToDest(
        timestamp,
        isAtomicCalls,
        ackType,
        srcChainGasParams,
        destChainParams,
        contractCalls
      )
    ).to.be.revertedWith("fee not set for this chain");
  });

  it("Should fail as insufficient fees sent", async function () {
    await gateway.initialize(
      CHAIN_ID,
      CHAIN_TYPE,
      VALIDATORS,
      POWERS,
      VALSET_NONCE
    );
    await gateway.setBridgeFees(0, DEST_CHAIN_ID, "1000");

    var timestamp = 1681014199;
    var isAtomicCalls = false;
    var ackType = 2;
    var srcChainGasParams = {
      gasLimit: 0,
      gasPrice: 0,
    };
    var destChainParams = {
      gasLimit: 0,
      gasPrice: 0,
      destChainType: 0,
      destChainId: DEST_CHAIN_ID,
    };
    var contractCalls = {
      payloads: ["0x000000"],
      destContractAddresses: ["0x5b38da6a701c568545dcfcb03fcb875f56beddc4"],
    };

    await expect(
      gateway.requestToDest(
        timestamp,
        isAtomicCalls,
        ackType,
        srcChainGasParams,
        destChainParams,
        contractCalls
      )
    ).to.be.revertedWith("insufficient fees sent");
  });

  it("Should call Request from Destination Chain", async function () {
    gateway.initialize(CHAIN_ID, CHAIN_TYPE, VALIDATORS, POWERS, VALSET_NONCE);
    const HelloWorld = await ethers.getContractFactory("HelloWorld");
    const helloWorld = await HelloWorld.deploy(gateway.address);

    expect(await helloWorld.gatewayContract()).to.be.equals(gateway.address);

    let _currentValset = {
      validators: VALIDATORS,
      powers: POWERS,
      valsetNonce: VALSET_NONCE,
    };
    let eventIdentifier = 1;
    let timestamp = 1681014199;
    let crossTalkNonce = 11;

    let caller = helloWorld.address;
    caller = caller.toLowerCase();
    console.log(caller, helloWorld.address);
    let payload = utils.defaultAbiCoder.encode(["string"], ["HelloString"]);

    const handlerBytes = helloWorld.address;
    let encoded_data = utils.defaultAbiCoder.encode(
      [
        "bytes32",
        "uint64",
        "uint64",
        "uint64",
        "string",
        "string",
        "uint64",
        "bytes",
        "bool",
        "uint64",
        "bytes[]",
        "bytes[]",
      ],
      [
        REQ_FROM_SOURCE_METHOD_NAME,
        eventIdentifier,
        crossTalkNonce,
        CHAIN_TYPE,
        CHAIN_ID,
        CHAIN_ID,
        CHAIN_TYPE,
        caller,
        false,
        timestamp,
        [handlerBytes],
        [payload],
      ]
    );
    const testBytes = utils.arrayify(encoded_data);
    const messageHash = utils.keccak256(testBytes);

    const messageHashBytes = utils.arrayify(messageHash);

    let sign = await signers[0].signMessage(messageHashBytes);
    let signature1 = utils.splitSignature(sign);

    let _sigs = [{ r: signature1.r, s: signature1.s, v: signature1.v }];
    let crossTalkPayload = {
      relayerRouterAddress: RELAYER_ROUTER_ADDRESS,
      isAtomic: false,
      eventIdentifier: eventIdentifier,
      expTimestamp: timestamp,
      crossTalkNonce: crossTalkNonce,
      sourceParams: {
        caller: caller,
        chainType: CHAIN_TYPE,
        chainId: CHAIN_ID,
      },
      contractCalls: {
        payloads: [payload],
        destContractAddresses: [handlerBytes],
      },
      isReadCall: false,
    };

    let expectedPayload =
      "0x00000000000000000000000000000000000000000000000000000000000000400000000000000000000000000000000000000000000000000000000000000080000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000001000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000000c0000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000000800000000000000000000000000000000000000000000000000000000000000040000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000000013100000000000000000000000000000000000000000000000000000000000000";
    await expect(
      gateway.requestFromSource(_currentValset, _sigs, crossTalkPayload)
    )
      .to.emit(gateway, "CrossTalkAckEvent")
      .withArgs(
        RELAYER_ROUTER_ADDRESS,
        caller,
        CHAIN_ID,
        CHAIN_TYPE,
        CHAIN_ID,
        CHAIN_TYPE,
        eventIdentifier,
        1,
        2,
        expectedPayload,
        0,
        true
      );
    expect(await helloWorld.greeting()).to.be.equals("HelloString");
    const contractCallsResult = defaultAbiCoder.decode(
      ["bool[]", "bytes[]"],
      expectedPayload
    );
    expect(contractCallsResult[0][0]).equals(true);
    const decodeResponse = defaultAbiCoder.decode(
      ["string", "uint64"],
      contractCallsResult[1][0]
    );
    console.log(decodeResponse);
  });

  it("Should call Request from Destination Chain", async function () {
    gateway.initialize(CHAIN_ID, CHAIN_TYPE, VALIDATORS, POWERS, VALSET_NONCE);
    const HelloWorld = await ethers.getContractFactory("HelloWorld");
    const helloWorld = await HelloWorld.deploy(gateway.address);

    expect(await helloWorld.gatewayContract()).to.be.equals(gateway.address);

    let _currentValset = {
      validators: VALIDATORS,
      powers: POWERS,
      valsetNonce: VALSET_NONCE,
    };
    let eventIdentifier = 1;
    let timestamp = 1681014199;
    let crossTalkNonce = 11;

    let caller = helloWorld.address;
    caller = caller.toLowerCase();
    console.log(caller, helloWorld.address);
    let payload = utils.defaultAbiCoder.encode(["string"], ["HelloString"]);

    const handlerBytes = helloWorld.address;
    let encoded_data = utils.defaultAbiCoder.encode(
      [
        "bytes32",
        "uint64",
        "uint64",
        "uint64",
        "string",
        "string",
        "uint64",
        "bytes",
        "bool",
        "uint64",
        "bytes[]",
        "bytes[]",
      ],
      [
        REQ_FROM_SOURCE_METHOD_NAME,
        eventIdentifier,
        crossTalkNonce,
        CHAIN_TYPE,
        CHAIN_ID,
        CHAIN_ID,
        CHAIN_TYPE,
        caller,
        false,
        timestamp,
        [],
        [],
      ]
    );
    const testBytes = utils.arrayify(encoded_data);
    const messageHash = utils.keccak256(testBytes);

    const messageHashBytes = utils.arrayify(messageHash);

    let sign = await signers[0].signMessage(messageHashBytes);
    let signature1 = utils.splitSignature(sign);

    let _sigs = [{ r: signature1.r, s: signature1.s, v: signature1.v }];
    let crossTalkPayload = {
      relayerRouterAddress: RELAYER_ROUTER_ADDRESS,
      isAtomic: false,
      eventIdentifier: eventIdentifier,
      expTimestamp: timestamp,
      crossTalkNonce: crossTalkNonce,
      sourceParams: {
        caller: caller,
        chainType: CHAIN_TYPE,
        chainId: CHAIN_ID,
      },
      contractCalls: {
        payloads: [],
        destContractAddresses: [],
      },
      isReadCall: false,
    };
    let expectedPayload =
      "0x0000000000000000000000000000000000000000000000000000000000000040000000000000000000000000000000000000000000000000000000000000006000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000";
    await expect(
      gateway.requestFromSource(_currentValset, _sigs, crossTalkPayload)
    )
      .to.emit(gateway, "CrossTalkAckEvent")
      .withArgs(
        RELAYER_ROUTER_ADDRESS,
        caller,
        CHAIN_ID,
        CHAIN_TYPE,
        CHAIN_ID,
        CHAIN_TYPE,
        eventIdentifier,
        1,
        2,
        expectedPayload,
        0,
        true
      );
  });

  it("Should call Request from Destination Chain while isAtomic is true", async function () {
    gateway.initialize(CHAIN_ID, CHAIN_TYPE, VALIDATORS, POWERS, VALSET_NONCE);
    const HelloWorld = await ethers.getContractFactory("HelloWorld");
    const helloWorld = await HelloWorld.deploy(gateway.address);

    expect(await helloWorld.gatewayContract()).to.be.equals(gateway.address);

    let _currentValset = {
      validators: VALIDATORS,
      powers: POWERS,
      valsetNonce: VALSET_NONCE,
    };
    let eventIdentifier = 1;
    let timestamp = 1681014199;
    let crossTalkNonce = 11;
    let isAtomic = true;

    let caller = helloWorld.address;
    caller = caller.toLowerCase();
    let payload = utils.defaultAbiCoder.encode(["string"], ["HelloString"]);
    let intPayload = utils.defaultAbiCoder.encode(["string"], [""]);

    const handlerBytes = helloWorld.address;
    let encoded_data = utils.defaultAbiCoder.encode(
      [
        "bytes32",
        "uint64",
        "uint64",
        "uint64",
        "string",
        "string",
        "uint64",
        "bytes",
        "bool",
        "uint64",
        "bytes[]",
        "bytes[]",
      ],
      [
        REQ_FROM_SOURCE_METHOD_NAME,
        eventIdentifier,
        crossTalkNonce,
        CHAIN_TYPE,
        CHAIN_ID,
        CHAIN_ID,
        CHAIN_TYPE,
        caller,
        isAtomic,
        timestamp,
        [handlerBytes, handlerBytes],
        [payload, intPayload],
      ]
    );
    const testBytes = utils.arrayify(encoded_data);
    const messageHash = utils.keccak256(testBytes);

    const messageHashBytes = utils.arrayify(messageHash);

    let sign = await signers[0].signMessage(messageHashBytes);
    let signature1 = utils.splitSignature(sign);

    let _sigs = [{ r: signature1.r, s: signature1.s, v: signature1.v }];
    let crossTalkPayload = {
      relayerRouterAddress: RELAYER_ROUTER_ADDRESS,
      isAtomic: isAtomic,
      eventIdentifier: eventIdentifier,
      expTimestamp: timestamp,
      crossTalkNonce: crossTalkNonce,
      sourceParams: {
        caller: caller,
        chainType: CHAIN_TYPE,
        chainId: CHAIN_ID,
      },
      contractCalls: {
        payloads: [payload, intPayload],
        destContractAddresses: [handlerBytes, handlerBytes],
      },
      isReadCall: false,
    };
    let expectedPayload =
      "0x810d14b8000000000000000000000000000000000000000000000000000000000000004000000000000000000000000000000000000000000000000000000000000000a000000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000001000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000040000000000000000000000000000000000000000000000000000000000000012000000000000000000000000000000000000000000000000000000000000000c000000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000080000000000000000000000000000000000000000000000000000000000000004000000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000001310000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000648d6ea8be0000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000001a537472696e672073686f756c64206e6f7420626520656d70747900000000000000000000000000000000000000000000000000000000000000000000";
    await expect(
      gateway.requestFromSource(_currentValset, _sigs, crossTalkPayload)
    )
      .to.emit(gateway, "CrossTalkAckEvent")
      .withArgs(
        RELAYER_ROUTER_ADDRESS,
        caller,
        CHAIN_ID,
        CHAIN_TYPE,
        CHAIN_ID,
        CHAIN_TYPE,
        eventIdentifier,
        1,
        2,
        expectedPayload,
        0,
        false
      );
    expect(await helloWorld.greeting()).to.be.equals("");
    let decodedErrData = Gateway.interface.decodeErrorResult(
      "ExecuteCallsRevert",
      expectedPayload
    );

    const iface = new ethers.utils.Interface([
      "error CustomError(string message)",
    ]);

    let errData = iface.decodeErrorResult("CustomError", decodedErrData[1][1]);
    expect(errData["message"]).equals("String should not be empty");
  });

  it("Should call Cross Talk Acknowledgement", async function () {
    gateway.initialize(CHAIN_ID, CHAIN_TYPE, VALIDATORS, POWERS, VALSET_NONCE);
    const HelloWorld = await ethers.getContractFactory("HelloWorld");
    const helloWorld = await HelloWorld.deploy(gateway.address);

    expect(await helloWorld.gatewayContract()).to.be.equals(gateway.address);

    let _currentValset = {
      validators: VALIDATORS,
      powers: POWERS,
      valsetNonce: VALSET_NONCE,
    };
    let eventIdentifier = 1;
    let execFlags = true;
    let execData =
      "0x000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000000800000000000000000000000000000000000000000000000000000000000000040000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000000013100000000000000000000000000000000000000000000000000000000000000";
    let crossTalkNonce = 11;

    const handlerBytes = helloWorld.address;
    let encoded_data = utils.defaultAbiCoder.encode(
      [
        "bytes32",
        "uint64",
        "uint64",
        "uint64",
        "string",
        "uint64",
        "string",
        "bytes",
        "bool[]",
        "bytes[]",
      ],
      [
        CROSS_TALK_ACK_METHOD_NAME,
        eventIdentifier,
        crossTalkNonce,
        CHAIN_TYPE,
        CHAIN_ID,
        CHAIN_TYPE,
        DEST_CHAIN_ID,
        handlerBytes,
        [execFlags],
        [execData],
      ]
    );
    const testBytes = utils.arrayify(encoded_data);
    const messageHash = utils.keccak256(testBytes);

    const messageHashBytes = utils.arrayify(messageHash);

    let sign = await signers[0].signMessage(messageHashBytes);
    let signature1 = utils.splitSignature(sign);

    let _sigs = [{ r: signature1.r, s: signature1.s, v: signature1.v }];
    let crossTalkAckPayload = {
      crossTalkNonce: crossTalkNonce,
      eventIdentifier: eventIdentifier,
      destChainType: CHAIN_TYPE,
      destChainId: DEST_CHAIN_ID,
      srcContractAddress: handlerBytes,
      execFlags: [execFlags],
      execData: [execData],
    };

    await gateway.crossTalkAck(_currentValset, _sigs, crossTalkAckPayload);
  });
});
