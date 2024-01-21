const { ethers, upgrades, network } = require("hardhat");
import { readFile, writeFile } from "node:fs/promises";
import { access, constants, mkdir } from "node:fs";

import config from "./../constants/config";

const isFileExist = (path: string) => {
  return new Promise((resolve, reject) => {
    access(path, constants.F_OK, (err) => {
      if (err) return resolve(false);
      resolve(true);
    });
  });
};

async function main() {
  console.info("Deployment Started ...");

  const NFT = await ethers.getContractFactory("NFT");
  const gatewayContractAddress = config[network.name].gatewayContractAddress;
  const _destGasLimit = 1000000;

  const nftProxy = await upgrades.deployProxy(NFT, [
    gatewayContractAddress,
    _destGasLimit,
  ]);
  await nftProxy.deployed();
  console.log("NFT contract deployed to ", nftProxy.address);

  const path = `${__dirname}/artifacts`;

  if (!(await isFileExist(`${path}`))) {
    await new Promise((resolve, reject) => {
      mkdir(path, { recursive: true }, (err) => {
        if (err) return reject("erro while creating dir");
        resolve("created");
      });
    });
  }

  if (!(await isFileExist(`${path}/deploy.json`))) {
    await writeFile(`${path}/deploy.json`, "{}");
  }

  const prevDetails = await readFile(`${path}/deploy.json`, {
    encoding: "utf8",
  });

  const prevDetailsJson: { [network: string]: string } = await JSON.parse(
    prevDetails
  );
  let newDeployData = { ...prevDetailsJson, [network.name]: nftProxy.address };
  await writeFile(`${path}/deploy.json`, JSON.stringify(newDeployData));
  console.log("Deploy file updated successfully!");
}

main()
  .then(() => console.info("Deploy complete !!"))
  .catch(console.error);
