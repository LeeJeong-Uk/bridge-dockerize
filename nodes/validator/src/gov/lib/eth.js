const api = require(ROOT + '/lib/api');
const txSender = require(ROOT + '/lib/txsender');
const config = require(ROOT + '/config');
const Britto = require(ROOT + '/lib/britto');

const errmInvalidTransaction =  {
    "errm": "[ETH] Invalid Transaction Id",
    "data": "NotFoundError: Can't find data"
}

async function init(){
    const eth = Britto.getNodeConfigBase('eth');

    eth.rpc = config.rpc.ETH_MAINNET_RPC;
    eth.abi = Britto.getJSONInterface({filename: 'MessageMultiSigWallet.abi'});

    new Britto(eth, 'GOV_ETH').connectWeb3();

    return eth;
}

async function _getTransaction(node, data, abiDecoder) {
    let _node = {...node};
    let mig = new _node.web3.eth.Contract(_node.abi, data.multisig);

    let transaction = await mig.methods.transactions(data.transactionId).call().catch(e => {return;});
    if(!transaction || transaction.destination === "0x0000000000000000000000000000000000000000"){
        return errmInvalidTransaction;
    }

    let myAddress = monitor.address["ETH"];
    if(!myAddress){
        return errmInvalidTransaction;
    }

    let confirmedValidatorList = await mig.methods.getConfirmations(data.transactionId).call().catch(e => {return;});
    if(!confirmedValidatorList){
        return errmInvalidTransaction;
    }

    let myConfirmation = false;
    for(let va of confirmedValidatorList){
        if(va.toLowerCase() === myAddress.toLowerCase())
            myConfirmation = true;
    }

    let required = await mig.methods.required().call().catch(e=>{return;});
    if(!required) {
        return errmInvalidTransaction;
    }

    transaction.myAddress = myAddress;
    transaction.myConfirmation = myConfirmation;
    transaction.multisig_requirement = required;
    transaction.confirmedValidatorList = confirmedValidatorList;

    let destinationContract = "Unknown Contract";
    for (var c in config.contract){
        if(!config.contract[c])
            continue;

        if(config.contract[c].toLowerCase() === transaction.destination.toLowerCase() && c.includes("ETH")){
            destinationContract = c;
            break;
        }
    }

    if(transaction.destination.toLowerCase() === config.governance.address.toLowerCase()){
        destinationContract = config.governance.chain + " Vault";
    }

    transaction.destinationContract = destinationContract;

    let decodedData = abiDecoder.decodeMethod(transaction.data);
    if(!decodedData){
        decodedData = "Unknown Transaction Call Data";
    }

    transaction.decodedData = decodedData;

    return transaction;
}

async function _confirmTransaction(node, data) {
    let validator = {...data.validator} || {};
    delete data.validator;

    async function confirm() {
        let params = [
            data.transactionId
        ];

        let txOptions = {
            from: validator.address,
            to: data.multisig
        };

        let gasPrice = await getCurrentGas().catch(e => {return;});
        if(!gasPrice){
            return {
                "errm": "[Ethereum] getGasPrice Error",
                "data": 'confirmTransaction getGasPrice error'
            };
        }

        txOptions.gasPrice = gasPrice;

        let _node = {...node};

        let contract = new _node.web3.eth.Contract(_node.abi, data.multisig);

        let transaction = await contract.methods.transactions(data.transactionId).call().catch(e => {return;});
        if(!transaction || transaction.destination === "0x0000000000000000000000000000000000000000"){
            return errmInvalidTransaction;
        }

        let required = await contract.methods.required().call().catch(e=>{return;});
        if(!required) {
            return errmInvalidTransaction;
        }

        let confirmedValidatorList = await contract.methods.getConfirmations(data.transactionId).call().catch(e => {return;});
        if(!confirmedValidatorList){
            return errmInvalidTransaction;
        }

        let myConfirmation = false;
        for(let va of confirmedValidatorList){
            if(va.toLowerCase() === validator.address.toLowerCase())
                myConfirmation = true;
        }

        if(myConfirmation || parseInt(required) === parseInt(confirmedValidatorList.length))
            return "Already Confirmed"

        let gasLimit = await contract.methods.confirmTransaction(data.transactionId).estimateGas(txOptions).catch(e => {
            logger.gov.error('[Ethereum] ConfirmTransaction estimateGas error: ' + e.message)
        });

        if (!gasLimit) {
            return {
                "errm": "[Ethereum] EstimateGas Error",
                "data": 'confirmTransaction estimateGas error'
            };
        }

        gasLimit = (parseInt(gasLimit) * 2).toString();
        txOptions.gasLimit = _node.web3.utils.toHex(gasLimit);

        let txData = {
            method: 'confirmTransaction',
            args: params,
            options: txOptions
        };

        const ret = await txSender.sendTransaction(_node, txData, {address: validator.address, pk: validator.pk});
        global.monitor && global.monitor.setProgress('GOV', 'confirmTransaction');
        return ret;
    }

    return await confirm();
}

async function getCurrentGas() {
    let gas = await api.ethGasPrice.request();
    return currentGasPrice = parseInt(((gas.fast * 0.1 + 0.5) * 1.2) * 10 ** 9);
}

module.exports = {
    init,
    _getTransaction,
    _confirmTransaction
}
