"""
Unit tests for the smart contract interface.
"""
import pytest
from unittest.mock import patch, MagicMock
from ..contracts.interface import OpenEditionContract, Split, MintParams

# Test data
TEST_SPLITS = [
    Split(address="tz1test1", shares=500),  # 5%
    Split(address="tz1test2", shares=300),  # 3%
    Split(address="tz1test3", shares=200)   # 2%
]

TEST_MINT_PARAMS = MintParams(
    amount=1,
    splits=TEST_SPLITS
)

TEST_OPERATORS = [
    {
        "add_operator": {
            "owner": "tz1test1",
            "operator": "tz1test2",
            "token_id": 1
        }
    }
]

@pytest.fixture
def contract():
    """Create a test contract instance."""
    return OpenEditionContract()

@pytest.mark.asyncio
async def test_mint_with_splits_success(contract):
    """Test successful minting with splits."""
    with patch("pytezos.contract.ContractCall") as mock_call:
        # Mock successful simulation
        mock_simulation = MagicMock()
        mock_simulation.is_success.return_value = True
        mock_simulation.dict.return_value = {"success": True}
        mock_simulation.suggested_fee = 1000
        mock_simulation.gas_used = 10000
        
        mock_operation = MagicMock()
        mock_operation.simulate.return_value = mock_simulation
        mock_operation.send.return_value = "op_hash"
        
        mock_call.return_value.autofill.return_value = mock_operation
        contract.contract.mint = mock_call
        
        result = await contract.mint_with_splits(TEST_MINT_PARAMS)
        
        assert result["success"]
        assert result["operation_hash"] == "op_hash"
        assert result["estimated_fee"] == 1000
        assert result["estimated_gas"] == 10000

@pytest.mark.asyncio
async def test_mint_with_splits_dry_run(contract):
    """Test minting simulation."""
    with patch("pytezos.contract.ContractCall") as mock_call:
        # Mock successful simulation
        mock_simulation = MagicMock()
        mock_simulation.is_success.return_value = True
        mock_simulation.dict.return_value = {"success": True}
        mock_simulation.suggested_fee = 1000
        mock_simulation.gas_used = 10000
        
        mock_operation = MagicMock()
        mock_operation.simulate.return_value = mock_simulation
        
        mock_call.return_value.autofill.return_value = mock_operation
        contract.contract.mint = mock_call
        
        result = await contract.mint_with_splits(TEST_MINT_PARAMS, dry_run=True)
        
        assert result["success"]
        assert "simulation" in result
        assert result["estimated_fee"] == 1000
        assert result["estimated_gas"] == 10000
        assert not mock_operation.send.called

@pytest.mark.asyncio
async def test_mint_with_splits_simulation_failure(contract):
    """Test handling of simulation failure."""
    with patch("pytezos.contract.ContractCall") as mock_call:
        # Mock failed simulation
        mock_simulation = MagicMock()
        mock_simulation.is_success.return_value = False
        mock_simulation.error = "Insufficient balance"
        
        mock_operation = MagicMock()
        mock_operation.simulate.return_value = mock_simulation
        
        mock_call.return_value.autofill.return_value = mock_operation
        contract.contract.mint = mock_call
        
        result = await contract.mint_with_splits(TEST_MINT_PARAMS)
        
        assert not result["success"]
        assert "Simulation failed" in result["error"]
        assert not mock_operation.send.called

@pytest.mark.asyncio
async def test_update_operators_success(contract):
    """Test successful operator update."""
    with patch("pytezos.contract.ContractCall") as mock_call:
        # Mock successful simulation
        mock_simulation = MagicMock()
        mock_simulation.is_success.return_value = True
        mock_simulation.dict.return_value = {"success": True}
        mock_simulation.suggested_fee = 1000
        mock_simulation.gas_used = 10000
        
        mock_operation = MagicMock()
        mock_operation.simulate.return_value = mock_simulation
        mock_operation.send.return_value = "op_hash"
        
        mock_call.return_value.autofill.return_value = mock_operation
        contract.contract.update_operators = mock_call
        
        result = await contract.update_operators(TEST_OPERATORS)
        
        assert result["success"]
        assert result["operation_hash"] == "op_hash"
        assert result["estimated_fee"] == 1000
        assert result["estimated_gas"] == 10000

@pytest.mark.asyncio
async def test_update_operators_dry_run(contract):
    """Test operator update simulation."""
    with patch("pytezos.contract.ContractCall") as mock_call:
        # Mock successful simulation
        mock_simulation = MagicMock()
        mock_simulation.is_success.return_value = True
        mock_simulation.dict.return_value = {"success": True}
        mock_simulation.suggested_fee = 1000
        mock_simulation.gas_used = 10000
        
        mock_operation = MagicMock()
        mock_operation.simulate.return_value = mock_simulation
        
        mock_call.return_value.autofill.return_value = mock_operation
        contract.contract.update_operators = mock_call
        
        result = await contract.update_operators(TEST_OPERATORS, dry_run=True)
        
        assert result["success"]
        assert "simulation" in result
        assert result["estimated_fee"] == 1000
        assert result["estimated_gas"] == 10000
        assert not mock_operation.send.called

@pytest.mark.asyncio
async def test_update_operators_simulation_failure(contract):
    """Test handling of operator update simulation failure."""
    with patch("pytezos.contract.ContractCall") as mock_call:
        # Mock failed simulation
        mock_simulation = MagicMock()
        mock_simulation.is_success.return_value = False
        mock_simulation.error = "Invalid operator"
        
        mock_operation = MagicMock()
        mock_operation.simulate.return_value = mock_simulation
        
        mock_call.return_value.autofill.return_value = mock_operation
        contract.contract.update_operators = mock_call
        
        result = await contract.update_operators(TEST_OPERATORS)
        
        assert not result["success"]
        assert "Simulation failed" in result["error"]
        assert not mock_operation.send.called

@pytest.mark.asyncio
async def test_get_contract_storage_success(contract):
    """Test successful contract storage fetch."""
    with patch("pytezos.contract.Contract") as mock_contract:
        # Mock storage data
        mock_storage = {
            "admin": "tz1admin",
            "paused": False,
            "operators": {}
        }
        
        mock_contract.storage.return_value = mock_storage
        contract.contract = mock_contract
        
        result = await contract.get_contract_storage()
        
        assert result["success"]
        assert result["storage"] == mock_storage

@pytest.mark.asyncio
async def test_get_contract_storage_error(contract):
    """Test error handling in contract storage fetch."""
    with patch("pytezos.contract.Contract") as mock_contract:
        mock_contract.storage.side_effect = Exception("Network error")
        contract.contract = mock_contract
        
        result = await contract.get_contract_storage()
        
        assert not result["success"]
        assert "Network error" in result["error"]

@pytest.mark.asyncio
async def test_split_validation():
    """Test split validation."""
    # Test total shares <= 100%
    total_shares = sum(s.shares for s in TEST_SPLITS)
    assert total_shares <= 1000, "Total shares should not exceed 100%"
    
    # Test individual shares > 0
    for split in TEST_SPLITS:
        assert split.shares > 0, "Individual shares should be positive"
        assert split.shares <= 1000, "Individual shares should not exceed 100%"
        
    # Test address format
    for split in TEST_SPLITS:
        assert split.address.startswith("tz1"), "Invalid address format"
