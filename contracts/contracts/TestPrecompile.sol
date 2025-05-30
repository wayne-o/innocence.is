// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

interface IHyperCoreRead {
    function getSpotBalance(uint256 asset, address user) external view returns (uint256);
    function getPerpPosition(uint256 asset, address user) external view returns (int256);
    function getAssetInfo(uint256 asset) external view returns (bool exists, uint8 decimals, string memory symbol);
}

interface IHyperCoreWrite {
    function sendSpot(uint256 asset, uint256 amount, address recipient) external;
    function openPerpPosition(uint256 asset, int256 size, uint256 maxSlippage) external;
    function closePerpPosition(uint256 asset, int256 size, uint256 minReceived) external;
}

contract TestPrecompile {
    IHyperCoreRead constant HYPERCORE_READ = IHyperCoreRead(0x0000000000000000000000000000000000000800);
    IHyperCoreWrite constant HYPERCORE_WRITE = IHyperCoreWrite(0x3333333333333333333333333333333333333333);
    
    event TestResult(string test, bool success, string data);
    
    function testReadPrecompile() external {
        try HYPERCORE_READ.getSpotBalance(1, address(this)) returns (uint256 balance) {
            emit TestResult("getSpotBalance", true, string(abi.encodePacked("Balance: ", uint2str(balance))));
        } catch Error(string memory reason) {
            emit TestResult("getSpotBalance", false, reason);
        } catch {
            emit TestResult("getSpotBalance", false, "Unknown error");
        }
        
        try HYPERCORE_READ.getAssetInfo(1) returns (bool exists, uint8 decimals, string memory symbol) {
            emit TestResult("getAssetInfo", true, string(abi.encodePacked("Exists: ", exists ? "true" : "false", ", Symbol: ", symbol)));
        } catch Error(string memory reason) {
            emit TestResult("getAssetInfo", false, reason);
        } catch {
            emit TestResult("getAssetInfo", false, "Unknown error");
        }
    }
    
    function testWritePrecompile() external {
        try HYPERCORE_WRITE.sendSpot(1, 100000000, address(this)) {
            emit TestResult("sendSpot", true, "Success");
        } catch Error(string memory reason) {
            emit TestResult("sendSpot", false, reason);
        } catch {
            emit TestResult("sendSpot", false, "Unknown error");
        }
    }
    
    function testPrecompileCode() external view returns (bool readHasCode, bool writeHasCode) {
        uint256 size;
        address readAddr = address(HYPERCORE_READ);
        assembly {
            size := extcodesize(readAddr)
        }
        readHasCode = size > 0;
        
        address writeAddr = address(HYPERCORE_WRITE);
        assembly {
            size := extcodesize(writeAddr)
        }
        writeHasCode = size > 0;
    }
    
    // Helper function to convert uint to string
    function uint2str(uint256 _i) internal pure returns (string memory) {
        if (_i == 0) {
            return "0";
        }
        uint256 j = _i;
        uint256 length;
        while (j != 0) {
            length++;
            j /= 10;
        }
        bytes memory bstr = new bytes(length);
        uint256 k = length;
        while (_i != 0) {
            k = k-1;
            uint8 temp = (48 + uint8(_i - _i / 10 * 10));
            bytes1 b1 = bytes1(temp);
            bstr[k] = b1;
            _i /= 10;
        }
        return string(bstr);
    }
}