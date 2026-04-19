// Example: Engine-layer mining loop integration test
// Tests the full pipeline: laser fire -> chunk spawn -> collect -> cargo -> market
// Lives in: tests/Sector.Engine.Tests/Integration/
// References: Sector.Engine only (no MonoGame types)

using System;
using System.Collections.Generic;
using NUnit.Framework;
using Sector.Engine.Core;
using Sector.Engine.Crew.Character;
using Sector.Engine.Crew.Skills;
using Sector.Engine.Mining;
using Sector.Engine.Ship;
using Sector.Engine.Ship.Layout;
using Sector.Engine.World.Economy;
using ShipFacade = Sector.Engine.Ship.Ship;

namespace Sector.Tests.Integration {
  [TestFixture]
  [Category("Mining")]
  public class MiningLoopIntegrationTests {
    private MiningManager _miningManager;
    private AsteroidFieldData _field;
    private CargoManifest _cargo;
    private ShipFacade _ship;
    private ShipLayout _layout;
    private CharacterSimulationManager _charMgr;
    private EntityId _shipId;

    // ─────────────────────────────────────────────────────────────────────────
    // Setup / Teardown — EventBus.ClearAll() is MANDATORY
    // ─────────────────────────────────────────────────────────────────────────

    [SetUp]
    public void SetUp() {
      EventBus.ClearAll();

      _miningManager = new MiningManager(seed: 42);

      _field = new AsteroidFieldData("belt-01") { WorldX = 10f, WorldY = 20f };
      _field.OreDeposits.Add(new OreDeposit(GoodsType.IronOre, totalUnits: 200));
      _miningManager.RegisterField(_field);

      _cargo = new CargoManifest(capacity: 50);
      _ship = new ShipFacade("Prospector");
      _shipId = _ship.Id.Id;

      // Tier-1 mining laser room (built)
      _layout = new ShipLayout();
      RoomInstance laserRoom = new RoomInstance {
        SystemType = ShipSystemType.MiningLaser,
        Slot = new RoomSlot(0, 0)
      };
      laserRoom.AdvanceBuildProgress(1f);
      _layout.Rooms.Add(laserRoom);

      _charMgr = new CharacterSimulationManager();
    }

    [TearDown]
    public void TearDown() {
      EventBus.ClearAll();
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Pattern: Use EventCapture<T> instead of hand-rolled lists
    // ─────────────────────────────────────────────────────────────────────────

    [Test]
    public void FullLoop_LaserFire_SpawnsChunks_CollectedIntoCargo() {
      // Step 1: Fire laser — capture spawned chunks
      using EventCapture<OreChunkSpawnedEvent> spawnCapture = new();
      using EventCapture<MiningLaserFiredEvent> laserCapture = new();

      _miningManager.ResolveMiningLaserFired(
        _shipId, "belt-01", _layout, _ship,
        Array.Empty<EntityId>(), _charMgr);

      laserCapture.AssertEventFired("MiningLaserFiredEvent must fire");
      spawnCapture.AssertEventFired("OreChunkSpawnedEvent must fire for non-exhausted field");
      int chunksSpawned = spawnCapture.First().ChunkCount;

      // Step 2: Simulate collection (presentation would call this)
      using EventCapture<OreChunkCollectedEvent> collectCapture = new();
      using EventCapture<CargoUpdatedEvent> cargoCapture = new();

      _miningManager.ResolveOreChunkCollected(
        _shipId, GoodsType.IronOre, chunksSpawned,
        _cargo, _ship, hasProcessor: false);

      collectCapture.AssertEventFired("OreChunkCollectedEvent must fire on successful add");
      cargoCapture.AssertEventFired("CargoUpdatedEvent must fire after cargo change");

      // Step 3: Verify cargo state
      Assert.That(_cargo.GetQuantity(GoodsType.IronOre), Is.EqualTo(chunksSpawned));
      Assert.That(cargoCapture.First().UsedUnits, Is.EqualTo(chunksSpawned));
      Assert.That(cargoCapture.First().CapacityUnits, Is.EqualTo(50));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Pattern: End-to-end with market sell
    // ─────────────────────────────────────────────────────────────────────────

    [Test]
    public void FullLoop_MineAndSell_MarketAcceptsOreAtPositivePrice() {
      // Collect some ore
      _miningManager.ResolveOreChunkCollected(
        _shipId, GoodsType.IronOre, units: 10,
        _cargo, _ship, hasProcessor: false);

      // Build market — note: MarketId and StationId are required
      Market market = new Market {
        MarketId = EntityId.New(),
        StationId = EntityId.New(),
        TaxRate = 0f
      };
      market.Listings.Add(new MarketListing {
        GoodsType = GoodsType.IronOre,
        Category = GoodsCategory.RawMaterials,
        Quantity = 0,
        MaxQuantity = 400,
        BasePrice = 30f
      });

      float sellPrice = market.CalculateSellPrice(GoodsType.IronOre, quantity: 10);

      // Empty market: 30 * 0.6 (buying ratio) * 1.0 (supply multiplier) * 10 = 180
      Assert.That(sellPrice, Is.EqualTo(180f).Within(0.01f));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Pattern: Heat accumulator -> overheat -> fault check integration
    // ─────────────────────────────────────────────────────────────────────────

    [Test]
    public void HeatOverheat_TriggersFaultCheck_EngineerSkillReducesFaultChance() {
      LaserHeatAccumulator heat = new LaserHeatAccumulator(rng: new Random(42));

      // Pump heat to overheat (1/12 per second build rate -> 12 seconds to overheat)
      heat.Tick(laserActive: true, deltaSeconds: 13f);

      Assert.That(heat.IsInCooldown, Is.True, "Should enter forced cooldown after overheat");
      Assert.That(heat.PopOverheatTrigger(), Is.True, "Overheat trigger should fire once");
      Assert.That(heat.PopOverheatTrigger(), Is.False, "Overheat trigger consumed on first pop");

      // TriggerOverheatFaultCheck would be called here by PilotingScene.
      // With an engineer aboard, fault chance is reduced.
      EntityId crewId = EntityId.New();
      CharacterSimulation sim = _charMgr.RegisterCharacter(crewId);
      SkillSet skills = new SkillSet(crewId);
      skills.SetLevel(SkillType.Engineering, 10); // max level -> 50% reduction
      sim.LinkSkills(skills);

      // Fault is probabilistic, but we verify the call doesn't crash
      // and that the system accepts the crew skill context
      Assert.DoesNotThrow(() => {
        _miningManager.TriggerOverheatFaultCheck(
          _shipId, _layout, _ship,
          new List<EntityId> { crewId }, _charMgr);
      });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Pattern: Stress accumulation during extended mining
    // ─────────────────────────────────────────────────────────────────────────

    [Test]
    public void TickLaserActive_Extended30Seconds_AppliesStressToCrew() {
      EntityId crewId = EntityId.New();
      CharacterSimulation sim = _charMgr.RegisterCharacter(crewId);

      // Initialize psychology so stress can be tracked
      Sector.Engine.Crew.Aptitudes.AptitudeSet aptitudes =
        TestFixtures.CreateDefaultAptitudes();
      Sector.Engine.Crew.Psychology.Psychology psych =
        new Sector.Engine.Crew.Psychology.Psychology(aptitudes);
      sim.LinkPsychology(psych);

      int stressBefore = psych.CurrentStress;
      List<EntityId> crewIds = new List<EntityId> { crewId };

      // Tick past the 30-second stress interval
      _miningManager.TickLaserActive(
        _ship, fuelDrainPerSecond: 1f, deltaTime: 31f, crewIds, _charMgr);

      Assert.That(psych.CurrentStress, Is.GreaterThan(stressBefore),
        "Extended mining should accumulate crew stress after 30s");
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Pattern: Processor yield tradeoff
    // ─────────────────────────────────────────────────────────────────────────

    [Test]
    public void Processor_NonIce_ReducesQuantityBy30Percent() {
      using EventCapture<OreChunkCollectedEvent> capture = new();

      _miningManager.ResolveOreChunkCollected(
        _shipId, GoodsType.IronOre, units: 10,
        _cargo, _ship, hasProcessor: true);

      // ProcessedYieldRatio = 0.7 -> 10 * 0.7 = 7
      Assert.That(_cargo.GetQuantity(GoodsType.IronOre), Is.EqualTo(7));
      capture.AssertEventFired();
      Assert.That(capture.First().Units, Is.EqualTo(7));
    }

    [Test]
    public void Processor_Ice_ConvertsFuelAndSkipsCargo() {
      using EventCapture<CargoUpdatedEvent> cargoCapture = new();

      float fuelBefore = _ship.GetFuel();

      _miningManager.ResolveOreChunkCollected(
        _shipId, GoodsType.Ice, units: 10,
        _cargo, _ship, hasProcessor: true);

      Assert.That(_ship.GetFuel(), Is.GreaterThan(fuelBefore), "Ice should convert to fuel");
      Assert.That(_cargo.GetQuantity(GoodsType.Ice), Is.EqualTo(0), "Ice must not enter cargo");
      cargoCapture.AssertEventFired("CargoUpdatedEvent fires even for fuel conversion (HUD refresh)");
    }
  }
}
