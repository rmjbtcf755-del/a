// Same cell step as server/GameServer.js (FFA). No sockets, tokens, or accounts.
(function (root) {
  var Quad = typeof QuadNode !== 'undefined' ? QuadNode : null;

  function Cell(nodeId, owner, position, mass, gameServer) {
    this.nodeId = nodeId;
    this.owner = owner;
    this.color = { r: 0, g: 255, b: 0 };
    this.position = position;
    this.mass = mass;
    this.size = Math.ceil(Math.sqrt(100 * this.mass));
    this.cellType = -1;
    this.spiked = 0;
    this.killedBy = null;
    this.gameServer = gameServer;
    this.moveEngineTicks = 0;
    this.moveEngineSpeed = 0;
    this.moveDecay = 0.75;
    this.angle = 0;
    this.hasSkipUpdate = true;
    this.currentSticker = null;
    this.stickerActive = false;
  }

  Cell.prototype.getName = function () {
    return this.owner ? this.owner.name : '';
  };
  Cell.prototype.getColor = function () {
    return this.color;
  };
  Cell.prototype.setColor = function (color) {
    this.color.r = color.r;
    this.color.b = color.b;
    this.color.g = color.g;
  };
  Cell.prototype.getType = function () {
    return this.cellType;
  };
  Cell.prototype.getSquareSize = function () {
    return (100 * this.mass) >> 0;
  };
  Cell.prototype.addMass = function (n) {
    this.mass = Math.min(this.mass + n, this.owner.gameServer.config.playerMaxMass);
    this.size = Math.ceil(Math.sqrt(100 * this.mass));
  };
  Cell.prototype.getSpeed = function () {
    return this.owner.gameServer.config.playerSpeed * Math.pow(this.mass, -1.0 / 4.5) * 50 / 40;
  };
  Cell.prototype.setAngle = function (radians) { this.angle = radians; };
  Cell.prototype.getAngle = function () { return this.angle; };
  Cell.prototype.setMoveEngineData = function (speed, ticks, decay) {
    this.moveEngineSpeed = speed;
    this.moveEngineTicks = ticks;
    this.moveDecay = isNaN(decay) ? 0.75 : decay;
  };
  Cell.prototype.getEatingRange = function () { return 0; };
  Cell.prototype.setKiller = function (cell) { this.killedBy = cell; };
  Cell.prototype.collisionCheck = function (bottomY, topY, rightX, leftX) {
    if (this.position.y > bottomY) return false;
    if (this.position.y < topY) return false;
    if (this.position.x > rightX) return false;
    if (this.position.x < leftX) return false;
    return true;
  };
  Cell.prototype.calcMovePhys = function (gameServer) {
    var X = this.position.x + (this.moveEngineSpeed * Math.sin(this.angle));
    var Y = this.position.y + (this.moveEngineSpeed * Math.cos(this.angle));
    this.moveEngineSpeed *= this.moveDecay;
    this.moveEngineTicks--;
    if (gameServer.flags.border) {
      if (X < gameServer.border.minx) {
        this.angle = 6.28 - this.angle;
        X = gameServer.border.minx;
      }
      if (Y < gameServer.border.miny) {
        this.angle = this.angle <= 3.14 ? 3.14 - this.angle : 9.42 - this.angle;
        Y = gameServer.border.miny;
      }
      if (X > gameServer.border.maxx) {
        this.angle = 6.28 - this.angle;
        X = gameServer.border.maxx;
      }
      if (Y > gameServer.border.maxy) {
        this.angle = this.angle <= 3.14 ? 3.14 - this.angle : 9.42 - this.angle;
        Y = gameServer.border.maxy;
      }
    }
    this.position.x = X;
    this.position.y = Y;
  };
  Cell.prototype.onConsume = function () {};
  Cell.prototype.onAdd = function () {};
  Cell.prototype.onRemove = function () {};
  Cell.prototype.onAutoMove = function () {};
  Cell.prototype.moveDone = function () {};

  function PlayerCell(nodeId, owner, position, mass, gameServer) {
    Cell.apply(this, arguments);
    this.cellType = 0;
    this.recombineTicks = 0;
    this.ignoreCollision = false;
    this.restoreCollisionTicks = 0;
  }
  PlayerCell.prototype = Object.create(Cell.prototype);
  PlayerCell.prototype.abs = function (x) { return x < 0 ? -x : x; };
  PlayerCell.prototype.calcMergeTime = function (base, megaSplit) {
    if (megaSplit == 0) this.recombineTicks = (base + ((0.002 * this.mass) >> 0)) * 20;
    else this.recombineTicks = 1 * 10;
  };
  PlayerCell.prototype.calcMove = function (x2, y2, gameServer) {
    var config = gameServer.config;
    var r = this.size;
    var deltaY = y2 - this.position.y;
    var deltaX = x2 - this.position.x;
    var angle = Math.atan2(deltaX, deltaY);
    var speed = this.getSpeed();
    var dist = Math.sqrt(
      (x2 - this.position.x) * (x2 - this.position.x) +
      (y2 - this.position.y) * (y2 - this.position.y)
    );
    speed = speed < dist ? speed : dist;
    var x1 = this.position.x + (speed * Math.sin(angle));
    var y1 = this.position.y + (speed * Math.cos(angle));
    if (gameServer.flags.selfPush) {
    for (var i = 0; i < this.owner.cells.length; i++) {
      var cell = this.owner.cells[i];
      if (this.nodeId == cell.nodeId || this.ignoreCollision || config.crazySplit) continue;
      if (cell.recombineTicks > 0 || this.recombineTicks > 0) {
        var collisionDist = cell.size + r;
        var dist2 = (cell.position.x - this.position.x) * (cell.position.x - this.position.x) +
          (cell.position.y - this.position.y) * (cell.position.y - this.position.y);
        if (dist2 < collisionDist * collisionDist) {
          var newDeltaY = cell.position.y - y1;
          var newDeltaX = cell.position.x - x1;
          var newAngle = Math.atan2(newDeltaX, newDeltaY);
          var move = collisionDist - Math.sqrt(dist2) + 5;
          cell.position.x = cell.position.x + (move * Math.sin(newAngle));
          cell.position.y = cell.position.y + (move * Math.cos(newAngle));
        }
      }
    }
    }
    if (gameServer.flags.border) {
      if (x1 < gameServer.border.minx) x1 = gameServer.border.minx;
      if (y1 < gameServer.border.miny) y1 = gameServer.border.miny;
      if (x1 > gameServer.border.maxx) x1 = gameServer.border.maxx;
      if (y1 > gameServer.border.maxy) y1 = gameServer.border.maxy;
    }
    this.position.x = x1;
    this.position.y = y1;
  };
  PlayerCell.prototype.getEatingRange = function () { return this.size * 0.4; };
  PlayerCell.prototype.onConsume = function (consumer) {
    if (!consumer.owner.nofood) consumer.addMass(this.mass);
  };
  PlayerCell.prototype.onAdd = function (gameServer) {
    gameServer.nodesPlayer.push(this);
  };
  PlayerCell.prototype.onRemove = function (gameServer) {
    var index = this.owner.cells.indexOf(this);
    if (index != -1) this.owner.cells.splice(index, 1);
    index = gameServer.nodesPlayer.indexOf(this);
    if (index != -1) gameServer.nodesPlayer.splice(index, 1);
  };
  PlayerCell.prototype.onAutoMove = function () {
    if (this.restoreCollisionTicks > 0) {
      this.restoreCollisionTicks--;
      if (this.restoreCollisionTicks <= 0) this.ignoreCollision = false;
    }
  };
  PlayerCell.prototype.moveDone = function () { this.ignoreCollision = false; };

  function Food(nodeId, owner, position, mass, gameServer) {
    Cell.apply(this, arguments);
    this.cellType = 1;
    this.size = Math.ceil(Math.sqrt(100 * this.mass));
    this.squareSize = (100 * this.mass) >> 0;
  }
  Food.prototype = Object.create(Cell.prototype);
  Food.prototype.getSquareSize = function () { return this.squareSize; };
  Food.prototype.onRemove = function (gameServer) {
    gameServer.currentFood--;
    if (!this._idReleased) {
      this._idReleased = true;
      gameServer.releaseFoodId(this.nodeId);
    }
  };
  Food.prototype.onConsume = function (consumer) { consumer.addMass(this.mass); };

  function EjectedMass(nodeId, owner, position, mass, gameServer) {
    Cell.apply(this, arguments);
    this.cellType = 3;
    this.size = Math.ceil(Math.sqrt(100 * this.mass));
    this.squareSize = (100 * this.mass) >> 0;
  }
  EjectedMass.prototype = Object.create(Cell.prototype);
  EjectedMass.prototype.getSquareSize = function () { return this.squareSize; };
  EjectedMass.prototype.onRemove = function (gameServer) {
    var index = gameServer.nodesEjected.indexOf(this);
    if (index != -1) gameServer.nodesEjected.splice(index, 1);
  };
  EjectedMass.prototype.onConsume = function (consumer) { consumer.addMass(this.mass); };
  EjectedMass.prototype.onAutoMove = function (gameServer) {
    if (!gameServer.flags.feedVirus) return;
    if (gameServer.nodesVirus.length < gameServer.config.virusMaxAmount) {
      var v = gameServer.getNearestVirus(this);
      if (v) {
        v.feed(this, gameServer);
        return true;
      }
    }
  };
  EjectedMass.prototype.moveDone = function (gameServer) {
    if (!this.onAutoMove(gameServer)) {
      gameServer.nodesEjected.push(this);
      gameServer.cleanupEjectCluster(this.position);
    } else return true;
  };

  function Virus(nodeId, owner, position, mass, gameServer) {
    Cell.apply(this, arguments);
    this.cellType = 2;
    this.spiked = 1;
    this.fed = 0;
    this.playerSplit = false;
    this.color = { r: 0, g: 255, b: 0 };
  }
  Virus.prototype = Object.create(Cell.prototype);
  Virus.prototype.getEatingRange = function () { return this.size * 0.4; };
  Virus.prototype.updateColor = function () {
    var r, g, b;
    switch (this.fed) {
      case 1: r = 128; g = 255; b = 0; break;
      case 2: r = 251; g = 255; b = 0; break;
      case 3: r = 255; g = 200; b = 0; break;
      case 4: r = 255; g = 150; b = 0; break;
      case 5: r = 255; g = 100; b = 0; break;
      case 6: r = 255; g = 50; b = 0; break;
      case 7: r = 0; g = 255; b = 0; break;
      default: r = 0; g = 255; b = 0; break;
    }
    this.setColor({ r: r, g: g, b: b });
  };
  Virus.prototype.feed = function (feeder, gameServer) {
    this.setAngle(feeder.getAngle());
    this.mass += feeder.mass;
    this.fed++;
    gameServer.removeNode(feeder, true);
    this.updateColor();
    if (this.fed >= gameServer.config.virusFeedAmount) {
      this.mass = gameServer.config.virusStartMass;
      this.fed = 0;
      gameServer.shootVirus(this);
    }
    this.size = Math.sqrt(100 * this.mass);
  };
  Virus.prototype.onConsume = function (consumer, gameServer) {
    if (!gameServer.flags.virusPop) {
      consumer.addMass(this.mass);
      return;
    }
    var client = consumer.owner;
    var maxSplits = Math.floor(consumer.mass / 16) - 1;
    var numSplits = gameServer.config.playerMaxCells - client.cells.length;
    numSplits = Math.min(numSplits, maxSplits);
    var splitMass = Math.min(consumer.mass / (numSplits + 1), 36);
    consumer.addMass(this.mass);
    if (numSplits <= 0) return;
    var bigSplits = 0;
    var endMass = consumer.mass - (numSplits * splitMass);
    if ((endMass > 300) && (numSplits > 0)) { bigSplits++; numSplits--; }
    if ((endMass > 1200) && (numSplits > 0)) { bigSplits++; numSplits--; }
    if ((endMass > 3000) && (numSplits > 0)) { bigSplits++; numSplits--; }
    var angle = 0;
    var k;
    for (k = 0; k < numSplits; k++) {
      angle += 6 / numSplits;
      gameServer.newCellVirused(client, consumer, angle, splitMass, 150);
      consumer.mass -= splitMass;
      consumer.size = Math.ceil(Math.sqrt(100 * consumer.mass));
    }
    for (k = 0; k < bigSplits; k++) {
      angle = Math.random() * 6.28;
      splitMass = consumer.mass / 4;
      gameServer.newCellVirused(client, consumer, angle, splitMass, 20);
      consumer.mass -= splitMass;
      consumer.size = Math.ceil(Math.sqrt(100 * consumer.mass));
    }
    consumer.calcMergeTime(gameServer.config.playerRecombineTime, gameServer.config.MegaSplit);
  };
  Virus.prototype.moveDone = function (gameServer) {
    if (this.playerSplit) gameServer.cleanupVirusCluster(this.position);
  };
  Virus.prototype.onAdd = function (gameServer) { gameServer.nodesVirus.push(this); };
  Virus.prototype.onRemove = function (gameServer) {
    var index = gameServer.nodesVirus.indexOf(this);
    if (index != -1) gameServer.nodesVirus.splice(index, 1);
    if (!this._idReleased) {
      this._idReleased = true;
      gameServer.releaseVirusId(this.nodeId);
    }
  };

  var BOT_NAMES = ['Муха','Паук','Кактус','Могучая','Ящерица','Лиса','Волк','Мамонт','Динозавр','Мороженое','Ракета','Зая','Фаун','Бабушка','Юпитер','Марс','Луна','Гора','Нептун','Плутон','Уран','Венера','Сатурн','Теннисистка','Первобытный','Влюблённый','Влюблённая'];

  function Player(game, name) {
    this.gameServer = game;
    this.pID = game.getNewPlayerID();
    this.name = name || '';
    this.cells = [];
    this.score = 0;
    this.hscore = 0;
    this.cscore = 0;
    this.lbRank = 0;
    this.mouse = { x: 0, y: 0 };
    this.spectate = true;
    this.isWeb = false;
    this.isF5Corpse = false;
    this.nofood = false;
    this.activeStickerId = null;
    this.color = { r: 255, g: 255, b: 255 };
    this.centerPos = { x: 0, y: 0 };
    this.sightRangeX = 0;
    this.sightRangeY = 0;
    this.viewBox = { topY: 0, bottomY: 0, leftX: 0, rightX: 0, width: 0, height: 0 };
    this.visibleNodes = [];
    this.nodeDestroyQueue = [];
    this.nodeAdditionQueue = [];
    this.tickViewBox = 0;
    this.team = 0;
    this.socket = { packetHandler: { dbUserData: null } };
  }
  Player.prototype.getName = function () { return this.name; };
  Player.prototype.getTeam = function () { return this.team; };
  Player.prototype.setColor = function (color) {
    this.color.r = color.r;
    this.color.b = color.b;
    this.color.g = color.g;
  };
  Player.prototype.getScore = function (reCalcScore) {
    if (reCalcScore) {
      var s = 0;
      for (var i = 0; i < this.cells.length; i++) {
        s += this.cells[i].mass;
        this.score = s;
        if (s > this.hscore) this.hscore = s;
      }
    }
    if (this.cells.length > this.cscore) this.cscore = this.cells.length;
    return this.score >> 0;
  };
  Player.prototype.updateSightRange = function () {
    var totalSize = 1.0;
    for (var i = 0; i < this.cells.length; i++) {
      if (!this.cells[i]) continue;
      totalSize += this.cells[i].size;
    }
    var factor = Math.pow(Math.min(64.0 / totalSize, 1), 0.4);
    this.sightRangeX = this.gameServer.config.serverViewBaseX / factor;
    this.sightRangeY = this.gameServer.config.serverViewBaseY / factor;
  };
  Player.prototype.updateCenter = function () {
    var len = this.cells.length;
    if (len <= 0) return;
    var X = 0, Y = 0;
    for (var i = 0; i < len; i++) {
      if (!this.cells[i]) continue;
      X += this.cells[i].position.x;
      Y += this.cells[i].position.y;
    }
    this.centerPos.x = X / len >> 0;
    this.centerPos.y = Y / len >> 0;
  };
  Player.prototype.calcViewBox = function () {
    this.updateSightRange();
    this.updateCenter();
    this.viewBox.topY = this.centerPos.y - this.sightRangeY;
    this.viewBox.bottomY = this.centerPos.y + this.sightRangeY;
    this.viewBox.leftX = this.centerPos.x - this.sightRangeX;
    this.viewBox.rightX = this.centerPos.x + this.sightRangeX;
    this.viewBox.width = this.sightRangeX;
    this.viewBox.height = this.sightRangeY;
    var list = [];
    this.gameServer.quadTree.find({
      minx: this.centerPos.x - this.sightRangeX,
      miny: this.centerPos.y - this.sightRangeY,
      maxx: this.centerPos.x + this.sightRangeX,
      maxy: this.centerPos.y + this.sightRangeY
    }, function (item) { if (item && item.cell) list.push(item.cell); });
    return list;
  };

  function Bot(game, name) {
    Player.call(this, game, name);
    this.isBot = true;
    this.gameState = 0;
    this.predators = [];
    this.threats = [];
    this.prey = [];
    this.food = [];
    this.virus = [];
    this.juke = false;
    this.target = null;
    this.targetVirus = null;
  }
  Bot.prototype = Object.create(Player.prototype);
  Bot.prototype.updateSightRange = function () {
    var range = 1500;
    if (this.cells[0]) range += this.cells[0].size * 2.5;
    this.sightRangeX = range;
    this.sightRangeY = range;
  };
  Bot.prototype.getLowestCell = function () {
    if (this.cells.length <= 0) return null;
    var lowest = this.cells[0];
    for (var i = 1; i < this.cells.length; i++) {
      if (lowest.mass > this.cells[i].mass) lowest = this.cells[i];
    }
    return lowest;
  };
  Bot.prototype.getDist = function (cell, check) {
    var xd = check.position.x - cell.position.x;
    xd = xd < 0 ? -xd : xd;
    var yd = check.position.y - cell.position.y;
    yd = yd < 0 ? -yd : yd;
    return xd + yd;
  };
  Bot.prototype.getAccDist = function (cell, check) {
    var xs = check.position.x - cell.position.x;
    var ys = check.position.y - cell.position.y;
    return Math.sqrt(xs * xs + ys * ys);
  };
  Bot.prototype.getAngle = function (c1, c2) {
    return Math.atan2(c1.position.x - c2.position.x, c1.position.y - c2.position.y);
  };
  Bot.prototype.reverseAngle = function (angle) {
    if (angle > Math.PI) angle -= Math.PI;
    else angle += Math.PI;
    return angle;
  };
  Bot.prototype.clearLists = function () {
    this.predators = [];
    this.threats = [];
    this.prey = [];
    this.food = [];
    this.virus = [];
    this.juke = false;
  };
  Bot.prototype.findNearest = function (cell, list) {
    if (this.currentTarget) return null;
    var shortest = list[0];
    var shortestDist = this.getDist(cell, shortest);
    for (var i = 1; i < list.length; i++) {
      var dist = this.getDist(cell, list[i]);
      if (shortestDist > dist) {
        shortest = list[i];
        shortestDist = dist;
      }
    }
    return shortest;
  };
  Bot.prototype.getRandom = function (list) {
    return list[Math.floor(Math.random() * list.length)];
  };
  Bot.prototype.getBiggest = function (list) {
    var biggest = list[0];
    for (var i = 1; i < list.length; i++) {
      if (list[i].mass > biggest.mass) biggest = list[i];
    }
    return biggest;
  };
  Bot.prototype.combineVectors = function (list) {
    var pos = { x: 0, y: 0 };
    for (var i = 0; i < list.length; i++) {
      pos.x += list[i].position.x;
      pos.y += list[i].position.y;
    }
    pos.x /= list.length;
    pos.y /= list.length;
    return pos;
  };
  Bot.prototype.findNearbyVirus = function (cell, checkDist, list) {
    var r = cell.size + 100;
    for (var i = 0; i < list.length; i++) {
      var dist = this.getDist(cell, list[i]) - r;
      if (checkDist > dist) return list[i];
    }
    return false;
  };
  Bot.prototype.getState = function (cell) {
    if (this.gameState == 4) return 4;
    if (this.predators.length <= 0) {
      if (this.prey.length > 0) return 3;
      if (this.food.length > 0) return 1;
    } else if (this.threats.length > 0) {
      if ((this.cells.length == 1) && (cell.mass > 180)) {
        var t = this.getBiggest(this.threats);
        var tl = this.findNearbyVirus(t, 500, this.virus);
        if (tl != false) {
          this.target = t;
          this.targetVirus = tl;
          return 4;
        }
      } else return 2;
    }
    return 0;
  };
  Bot.prototype.decide = function (cell) {
    var gameServer = this.gameServer;
    switch (this.gameState) {
      case 0:
        if (this.centerPos.x == this.mouse.x && this.centerPos.y == this.mouse.y) {
          var randomNode = gameServer.nodes[Math.floor(Math.random() * gameServer.nodes.length)];
          var pos;
          if (randomNode && (randomNode.getType() == 3 || randomNode.getType() == 1 || randomNode.getType() == 16)) {
            pos = { x: randomNode.position.x, y: randomNode.position.y };
          } else pos = gameServer.getRandomPosition();
          this.mouse = { x: pos.x, y: pos.y };
        }
        break;
      case 1:
        if (!this.target || this.visibleNodes.indexOf(this.target) == -1) {
          this.target = this.findNearest(cell, this.food);
          this.mouse = { x: this.target.position.x, y: this.target.position.y };
        }
        break;
      case 2:
        var avoid = this.combineVectors(this.predators);
        var deltaY = avoid.y - cell.position.y;
        var deltaX = avoid.x - cell.position.x;
        var angle = Math.atan2(deltaX, deltaY);
        if (angle > Math.PI) angle -= Math.PI;
        else angle += Math.PI;
        this.mouse = {
          x: cell.position.x + (500 * Math.sin(angle)),
          y: cell.position.y + (500 * Math.cos(angle))
        };
        if (this.juke) gameServer.splitCells(this);
        break;
      case 3:
        if (!this.target || (cell.mass < (this.target.mass * 1.2)) || this.target.mass > 200 || this.visibleNodes.indexOf(this.target) == -1) {
          this.target = this.getRandom(this.prey);
        }
        this.mouse = { x: this.target.position.x, y: this.target.position.y };
        var massReq = 1.25 * (this.target.mass * 2) * this.cells.length;
        if ((cell.mass > massReq) && (this.cells.length < 3)) {
          var splitDist = (4 * (cell.getSpeed() * 6)) + (cell.size * 1.75);
          var distToTarget = this.getAccDist(cell, this.target);
          if (splitDist >= distToTarget) {
            if (this.threats.length > 0 && this.getBiggest(this.threats).mass > (1.25 * (cell.mass / 2))) break;
            gameServer.splitCells(this);
          }
        }
        break;
      case 4:
        if (!this.target || !this.targetVirus || !(this.cells.length == 1) || this.visibleNodes.indexOf(this.target) == -1 || this.visibleNodes.indexOf(this.targetVirus) == -1) {
          this.gameState = 0;
          this.target = null;
          break;
        }
        var dist = this.getDist(this.targetVirus, this.target) - (this.target.size + 100);
        if (dist > 500) {
          this.gameState = 0;
          this.target = null;
          break;
        }
        var aim = this.getAngle(this.target, this.targetVirus);
        var reversed = this.reverseAngle(aim);
        var ourAngle = this.getAngle(cell, this.targetVirus);
        if ((ourAngle <= (reversed + 0.25)) && (ourAngle >= (reversed - 0.25))) {
          this.mouse = { x: this.targetVirus.position.x, y: this.targetVirus.position.y };
          for (var v = 0; v < 5; v++) gameServer.ejectMass(this);
          this.mouse = { x: cell.position.x, y: cell.position.y };
          this.gameState = 0;
          this.target = null;
        } else {
          var radius = cell.size;
          this.mouse = {
            x: this.targetVirus.position.x + ((350 + radius) * Math.sin(reversed)),
            y: this.targetVirus.position.y + ((350 + radius) * Math.cos(reversed))
          };
        }
        break;
      default:
        this.gameState = 0;
        break;
    }
    if (this.cells.length > 1) {
      var ready = 0;
      for (var n = 0; n < this.cells.length; n++) {
        if (this.cells[n].recombineTicks == 0) ready++;
      }
      if (ready >= 2) {
        this.mouse.x = this.centerPos.x;
        this.mouse.y = this.centerPos.y;
        this.gameState = 0;
      }
    }
  };
  Bot.prototype.update = function () {
    for (var i = 0; i < this.nodeDestroyQueue.length; i++) {
      var index = this.visibleNodes.indexOf(this.nodeDestroyQueue[i]);
      if (index > -1) this.visibleNodes.splice(index, 1);
    }
    if ((this.tickViewBox <= 0) && this.gameServer.run) {
      this.visibleNodes = this.calcViewBox();
      this.tickViewBox = 10;
    } else {
      this.tickViewBox--;
      return;
    }
    if (this.cells.length <= 0) {
      this.gameServer.spawnPlayer(this);
      return;
    }
    var cell = this.getLowestCell();
    var r = cell.size;
    this.clearLists();
    for (var n = 0; n < this.visibleNodes.length; n++) {
      var check = this.visibleNodes[n];
      if (!check || cell.owner == check.owner) continue;
      switch (check.getType()) {
        case 0:
          if (cell.mass > (check.mass * 1.125) && check.mass > 100) this.prey.push(check);
          else if (check.mass > (cell.mass * 1.2)) {
            var gap = this.getDist(cell, check) - (r + check.size);
            if (gap < 300) {
              this.predators.push(check);
              if (this.cells.length == 1 && gap < 0) this.juke = true;
            }
            this.threats.push(check);
          } else this.threats.push(check);
          break;
        case 1:
        case 16:
          this.food.push(check);
          break;
        case 2:
          this.virus.push(check);
          break;
        case 3:
          if (cell.mass > 16) this.food.push(check);
          break;
        default:
          break;
      }
    }
    var newState = this.getState(cell);
    if (newState != this.gameState && newState != 4) this.target = null;
    this.gameState = newState;
    this.decide(cell);
    this.nodeDestroyQueue = [];
  };

  function defaultConfig() {
    return {
      serverTickMs: 50,
      netMaxCatchupTicks: 2,
      serverGamemode: 0,
      serverBots: 5,
      serverOldColors: 0,
      serverViewBaseX: 1220,
      serverViewBaseY: 780,
      mapWidth: 28000,
      mapHeight: 28000,
      spawnInterval: 10,
      foodSpawnAmount: 500,
      foodStartAmount: 1000,
      foodMaxAmount: 4500,
      foodMass: 5,
      foodMaxMass: 5,
      virusMinAmount: 140,
      virusMaxAmount: 280,
      virusStartMass: 100,
      virusFeedAmount: 7,
      virusClusterRadius: 900,
      virusClusterMaxPct: 20,
      ejectClusterRadius: 180,
      ejectClusterMax: 35,
      MegaSplit: 0,
      crazySplit: 0,
      ejectMass: 12,
      ejectMassLoss: 16,
      ejectSpeed: 165,
      ejectSpawnPlayer: 50,
      playerStartMass: 30,
      playerMaxMass: 22500,
      playerSpeed: 40,
      playerSplitSizeMult: 0.5,
      playerSplitSpeedAdd: 0,
      playerSplitSpeedMultiplier: 6,
      playerPopsplitSpeed: 1,
      playerMinMassEject: 32,
      playerMinMassSplit: 36,
      playerSmoothSplit: 1,
      playerMaxCells: 16,
      playerRecombineTime: 50,
      playerMassDecayRate: 0.002,
      playerMinMassDecay: 9,
      playerMaxNickLength: 16,
      teamsCollision: 1
    };
  }

  function parseIni(text) {
    var out = {};
    var lines = String(text || '').split(/[\r\n]+/);
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      if (!line || /^\s*[;#]/.test(line)) continue;
      var match = line.match(/^([^=]+)(=(.*))?$/);
      if (!match) continue;
      var key = match[1].trim();
      if (key.substr(0, 2) === '//') continue;
      var value = match[3] != null ? match[3].trim() : true;
      if (typeof value === 'string') {
        var cut = '';
        var esc = false;
        for (var c = 0; c < value.length; c++) {
          var ch = value.charAt(c);
          if (esc) { cut += ch; esc = false; }
          else if (ch === '\\') esc = true;
          else if (ch === ';' || ch === '#') break;
          else cut += ch;
        }
        value = cut.trim();
        if (value !== '' && !isNaN(value)) value = parseFloat(value);
      }
      out[key] = value;
    }
    return out;
  }

  function Game() {
    this.run = true;
    this.lastNodeId = 65536;
    this.nextFoodId = 1;
    this.freeFoodIds = [];
    this.retiredFoodIds = [];
    this.virusNodeBase = 2147483648;
    this.nextVirusId = 1;
    this.freeVirusIds = [];
    this.retiredVirusIds = [];
    this.lastPlayerId = 1;
    this.clients = [];
    this.nodes = [];
    this.nodesVirus = [];
    this.nodesEjected = [];
    this.nodesPlayer = [];
    this.currentFood = 0;
    this.movingNodes = [];
    this.leaderboard = [];
    this.config = defaultConfig();
    this.flags = {
      food: true, virus: true, decay: true, eject: true, split: true,
      merge: true, selfPush: true, bots: true, eatPlayers: true,
      eatFood: true, eatEject: true, eatVirus: true, virusPop: true,
      feedVirus: true, ejectSpawn: true, border: true
    };
    this.configRev = 0;
    this._simAt = 0;
    this.viewCells = [];
    this.viewSx = this.config.serverViewBaseX;
    this.viewSy = this.config.serverViewBaseY;
    this.decayMod = 1;
    this.haveTeams = false;
    this.tick = 0;
    this.tickMain = 0;
    this.tickSpawn = 0;
    this.botNames = BOT_NAMES.slice();
    this.botNameIndex = 0;
    this.oldcolors = [
      { r: 235, b: 0, g: 75 }, { r: 225, b: 255, g: 125 }, { r: 180, b: 20, g: 7 },
      { r: 80, b: 240, g: 170 }, { r: 180, b: 135, g: 90 }, { r: 195, b: 0, g: 240 },
      { r: 150, b: 255, g: 18 }, { r: 80, b: 0, g: 245 }, { r: 165, b: 0, g: 25 },
      { r: 80, b: 0, g: 145 }, { r: 80, b: 240, g: 170 }, { r: 55, b: 255, g: 92 }
    ];
    this.input = { split: false, eject: false, splitArm: false, ejectArm: false, lastSpace: 0, lastEject: 0 };
    this.setBorder(this.config.mapWidth, this.config.mapHeight);
    this.quadTree = new Quad(this.border, 64, 32);
    this.human = new Player(this, '');
    this.clients.push({ playerTracker: this.human });
    this._timer = null;
    this._nextAt = 0;
  }

  Game.prototype.applyIni = function (text) {
    var prevW = this.config.mapWidth;
    var prevH = this.config.mapHeight;
    var parsed = parseIni(text);
    for (var key in parsed) this.config[key] = parsed[key];
    if (this.config.mapWidth !== prevW || this.config.mapHeight !== prevH) {
      this.setBorder(this.config.mapWidth, this.config.mapHeight);
      if (this.nodes.length) this.rebuildQuad();
      else this.quadTree = new Quad(this.border, 64, 32);
    }
    this.configRev++;
  };

  Game.prototype.setBorder = function (width, height) {
    var hw = width / 2;
    var hh = height / 2;
    this.border = {
      minx: -hw, miny: -hh, maxx: hw, maxy: hh,
      width: width, height: height, centerx: 0, centery: 0
    };
  };

  Game.prototype.rebuildQuad = function () {
    var nodes = this.nodes.slice();
    for (var i = 0; i < nodes.length; i++) {
      var item = nodes[i].quadItem;
      if (item && item._quadNode) {
        try { item._quadNode.remove(item); } catch (err) {}
      }
    }
    this.quadTree = new Quad(this.border, 64, 32);
    for (var n = 0; n < nodes.length; n++) {
      var node = nodes[n];
      var quadItem = node.quadItem;
      if (!quadItem) continue;
      var x = node.position.x;
      var y = node.position.y;
      var size = node.size;
      quadItem.x = x;
      quadItem.y = y;
      quadItem.size = size;
      quadItem.bound.minx = x - size;
      quadItem.bound.miny = y - size;
      quadItem.bound.maxx = x + size;
      quadItem.bound.maxy = y + size;
      quadItem._quadNode = null;
      this.quadTree.insert(quadItem);
    }
  };

  Game.prototype.tickMs = function () {
    var ms = this.config.serverTickMs | 0;
    return ms >= 20 ? ms : 50;
  };

  Game.prototype.getNewPlayerID = function () {
    if (this.lastPlayerId > 2147483647) this.lastPlayerId = 1;
    return this.lastPlayerId++;
  };
  Game.prototype.getNextNodeId = function () {
    if (this.lastNodeId > 2147483647) this.lastNodeId = 65536;
    return this.lastNodeId++;
  };
  Game.prototype.getRandomPosition = function () {
    return {
      x: this.border.minx + this.border.width * Math.random(),
      y: this.border.miny + this.border.height * Math.random()
    };
  };
  Game.prototype.getRandomSpawn = function () { return this.getRandomPosition(); };
  Game.prototype.normalizeFractlPart = function (n) {
    return (n % (Math.PI * 2)) / (Math.PI * 2);
  };
  Game.prototype.getFractionPosition = function (n) {
    return {
      x: this.border.minx + this.border.width * this.normalizeFractlPart(n),
      y: this.border.miny + this.border.height * this.normalizeFractlPart(n * n)
    };
  };
  Game.prototype.getRandomColor = function () {
    if (this.config.serverOldColors) {
      var color = this.oldcolors[Math.floor(Math.random() * this.oldcolors.length)];
      return { r: color.r, b: color.b, g: color.g };
    }
    var colorRGB = [0xFF, 0x07, (Math.random() * 256) >> 0];
    colorRGB.sort(function () { return 0.5 - Math.random(); });
    return { r: colorRGB[0], b: colorRGB[1], g: colorRGB[2] };
  };
  Game.prototype.foodRgb = function (id) {
    var n = (Math.imul(id, 747796405) + 2891336453) >>> 0;
    var third = n & 255;
    n = (Math.imul(n, 1664525) + 1013904223) >>> 0;
    var slots = [255, 7, third];
    var order = [
      [0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]
    ][n % 6];
    var rgb = [slots[order[0]], slots[order[1]], slots[order[2]]];
    return { r: rgb[0], b: rgb[1], g: rgb[2] };
  };
  Game.prototype.foodInsidePlayer = function (x, y) {
    var inside = false;
    this.quadTree.find({
      minx: x - 1600, miny: y - 1600, maxx: x + 1600, maxy: y + 1600
    }, function (item) {
      if (inside || !item || !item.cell) return;
      var cell = item.cell;
      if (cell.cellType !== 0) return;
      var dx = cell.position.x - x;
      var dy = cell.position.y - y;
      var size = cell.size;
      if (dx * dx + dy * dy < size * size) inside = true;
    });
    return inside;
  };
  Game.prototype.allocFoodId = function () {
    for (var n = 0; n < 24; n++) {
      var id = 0;
      if (this.nextFoodId <= 65535) id = this.nextFoodId++;
      else if (this.freeFoodIds.length) {
        var free = this.freeFoodIds;
        var j = (Math.random() * free.length) | 0;
        id = free[j];
        var last = free.pop();
        if (j < free.length) free[j] = last;
      } else return 0;
      var pos = this.getFractionPosition(id);
      if (!this.foodInsidePlayer(pos.x, pos.y)) return id;
      this.freeFoodIds.push(id);
    }
    return 0;
  };
  Game.prototype.releaseFoodId = function (id) {
    if (id > 0 && id <= 65535) this.retiredFoodIds.push(id);
  };
  Game.prototype.rotateFoodIds = function () {
    if (!this.retiredFoodIds.length) return;
    var retired = this.retiredFoodIds;
    this.retiredFoodIds = [];
    for (var i = 0; i < retired.length; i++) this.freeFoodIds.push(retired[i]);
  };
  Game.prototype.allocVirusId = function () {
    var wire = 0;
    if (this.nextVirusId <= 65535) wire = this.nextVirusId++;
    else if (this.freeVirusIds.length) wire = this.freeVirusIds.shift();
    if (!wire) return 0;
    return this.virusNodeBase + wire;
  };
  Game.prototype.releaseVirusId = function (id) {
    var wire = id - this.virusNodeBase;
    if (wire > 0 && wire <= 65535) this.retiredVirusIds.push(wire);
  };
  Game.prototype.rotateVirusIds = function () {
    if (!this.retiredVirusIds.length) return;
    var retired = this.retiredVirusIds;
    this.retiredVirusIds = [];
    for (var i = 0; i < retired.length; i++) this.freeVirusIds.push(retired[i]);
  };

  Game.prototype.addNode = function (node) {
    node._nodeIndex = this.nodes.length;
    this.nodes.push(node);
    var x = node.position.x;
    var y = node.position.y;
    var size = node.size;
    node._px = x;
    node._py = y;
    node._ps = size;
    node.quadItem = {
      cell: node, x: x, y: y, size: size,
      bound: { minx: x - size, miny: y - size, maxx: x + size, maxy: y + size }
    };
    this.quadTree.insert(node.quadItem);
    if (node.owner) {
      node.setColor(node.owner.color);
      node.owner.cells.push(node);
    }
    node.onAdd(this);
  };
  Game.prototype.removeNode = function (node) {
    var nodes = this.nodes;
    var index = node._nodeIndex;
    if (index === undefined || nodes[index] !== node) index = nodes.indexOf(node);
    if (index !== -1) {
      var last = nodes.pop();
      if (last !== node) {
        nodes[index] = last;
        last._nodeIndex = index;
      }
      node._nodeIndex = -1;
    }
    if (node.quadItem && node.quadItem._quadNode) this.quadTree.remove(node.quadItem);
    index = this.movingNodes.indexOf(node);
    if (index !== -1) this.movingNodes.splice(index, 1);
    node.onRemove(this);
  };
  Game.prototype.setAsMovingNode = function (node) { this.movingNodes.push(node); };
  Game.prototype.updateNodeQuad = function (node) {
    var item = node.quadItem;
    if (!item) return;
    var x = node.position.x;
    var y = node.position.y;
    var size = node.size;
    if (item.x === x && item.y === y && item.size === size) return;
    item.x = x;
    item.y = y;
    item.size = size;
    item.bound.minx = x - size;
    item.bound.miny = y - size;
    item.bound.maxx = x + size;
    item.bound.maxy = y + size;
    this.quadTree.update(item);
  };

  Game.prototype.spawnFood = function () {
    var id = this.allocFoodId();
    if (!id) return;
    var food = new Food(id, null, this.getFractionPosition(id), this.config.foodMass, this);
    food.setColor(this.foodRgb(id));
    this.addNode(food);
    this.currentFood++;
  };
  Game.prototype.startingFood = function () {
    for (var i = 0; i < this.config.foodStartAmount; i++) this.spawnFood();
  };
  Game.prototype.updateFood = function () {
    if (this.currentFood > this.config.foodMaxAmount) {
      for (var n = this.nodes.length - 1; n >= 0 && this.currentFood > this.config.foodMaxAmount; n--) {
        if (this.nodes[n] && this.nodes[n].cellType === 1) this.removeNode(this.nodes[n]);
      }
    }
    if (!this.flags.food) return;
    var toSpawn = Math.min(this.config.foodSpawnAmount, this.config.foodMaxAmount - this.currentFood);
    for (var i = 0; i < toSpawn; i++) this.spawnFood();
  };

  Game.prototype.spawnPlayer = function (player, pos, mass) {
    if (mass == null) mass = this.config.playerStartMass;
    var minDistSize = 100;
    var maxAttempts = 64;
    var playerSquareSize = (mass * 100) >> 0;
    pos = pos || this.getRandomSpawn();
    var found = false;
    var reach = Math.sqrt((this.config.playerMaxMass * 100) + playerSquareSize + minDistSize * minDistSize) + 8;
    for (var attempt = 0; attempt < maxAttempts; attempt++) {
      var collision = false;
      this.quadTree.find({
        minx: pos.x - reach, miny: pos.y - reach, maxx: pos.x + reach, maxy: pos.y + reach
      }, function (item) {
        if (collision || !item || !item.cell) return;
        var check = item.cell;
        var squareR = check.getSquareSize();
        var dx = check.position.x - pos.x;
        var dy = check.position.y - pos.y;
        if (dx * dx + dy * dy <= squareR + playerSquareSize + minDistSize * minDistSize) collision = true;
      });
      if (!collision) { found = true; break; }
      pos = this.getRandomSpawn();
    }
    if (!found) return;
    var cell = new PlayerCell(this.getNextNodeId(), player, pos, mass, this);
    this.addNode(cell);
    player.mouse = { x: pos.x, y: pos.y };
  };

  Game.prototype.onPlayerSpawn = function (player) {
    player.color = this.getRandomColor();
    var pos = null;
    var startMass = null;
    if (this.flags.ejectSpawn && this.nodesEjected.length > 0) {
      var roll = Math.floor(Math.random() * 100) + 1;
      if (roll <= this.config.ejectSpawnPlayer) {
        var ejected = this.nodesEjected[Math.floor(Math.random() * this.nodesEjected.length)];
        this.removeNode(ejected);
        pos = { x: ejected.position.x, y: ejected.position.y };
        startMass = ejected.mass;
        var color = ejected.getColor ? ejected.getColor() : ejected.color;
        player.setColor({ r: color.r, g: color.g, b: color.b });
      }
    }
    this.spawnPlayer(player, pos, startMass);
    player.spectate = false;
  };

  Game.prototype.spawn = function (player, nick) {
    if (!player || player.cells.length > 0) return;
    var max = this.config.playerMaxNickLength | 0 || 16;
    var name = String(nick || 'Игрок').replace(/[\r\n\t#<>]/g, ' ').replace(/\s+/g, ' ').trim();
    player.name = (name || 'Игрок').slice(0, max);
    this.onPlayerSpawn(player);
  };

  Game.prototype.addBot = function () {
    var name = 'bot' + (++this.botNameIndex);
    if (this.botNames.length) {
      var index = Math.floor(Math.random() * this.botNames.length);
      name = String(this.botNames[index] || '').replace('\r', '');
      this.botNames.splice(index, 1);
    }
    var bot = new Bot(this, name);
    this.clients.push({ playerTracker: bot });
    this.onPlayerSpawn(bot);
  };

  Game.prototype.boot = function () {
    this.startingFood();
    this.syncBots();
    this.captureView();
  };

  Game.prototype.botList = function () {
    var list = [];
    for (var i = 0; i < this.clients.length; i++) {
      var player = this.clients[i] && this.clients[i].playerTracker;
      if (player && player.isBot) list.push(this.clients[i]);
    }
    return list;
  };

  Game.prototype.removePlayer = function (client) {
    var player = client && client.playerTracker;
    if (!player) return;
    var cells = player.cells.slice();
    for (var i = 0; i < cells.length; i++) this.removeNode(cells[i]);
    var index = this.clients.indexOf(client);
    if (index !== -1) this.clients.splice(index, 1);
  };

  Game.prototype.syncBots = function () {
    var bots = this.botList();
    if (!this.flags.bots) {
      for (var i = 0; i < bots.length; i++) this.removePlayer(bots[i]);
      return;
    }
    var want = Math.max(0, this.config.serverBots | 0);
    while (bots.length > want) this.removePlayer(bots.pop());
    while (this.botList().length < want) this.addBot();
  };

  Game.prototype.setValue = function (key, value) {
    if (typeof value !== 'number' || !isFinite(value)) return;
    var prevW = this.config.mapWidth;
    var prevH = this.config.mapHeight;
    this.config[key] = value;
    if (key === 'mapWidth' || key === 'mapHeight') {
      var w = Math.max(1000, this.config.mapWidth);
      var h = Math.max(1000, this.config.mapHeight);
      this.config.mapWidth = w;
      this.config.mapHeight = h;
      if (w !== prevW || h !== prevH) {
        this.setBorder(w, h);
        if (this.nodes.length) this.rebuildQuad();
        else this.quadTree = new Quad(this.border, 64, 32);
      }
    }
    if (key === 'serverBots') this.syncBots();
    this.configRev++;
  };

  Game.prototype.setFlag = function (name, on) {
    if (name === 'crazySplit' || name === 'MegaSplit') {
      this.config[name] = on ? 1 : 0;
      return;
    }
    if (!this.flags || !(name in this.flags)) return;
    this.flags[name] = !!on;
    if (name === 'bots') this.syncBots();
  };

  Game.prototype.resetWorld = function () {
    var nick = this.human.name;
    var alive = this.human.cells.length > 0;
    var nodes = this.nodes.slice();
    for (var i = 0; i < nodes.length; i++) this.removeNode(nodes[i]);
    this.currentFood = 0;
    this.movingNodes.length = 0;
    this.nextFoodId = 1;
    this.freeFoodIds = [];
    this.retiredFoodIds = [];
    this.nextVirusId = 1;
    this.freeVirusIds = [];
    this.retiredVirusIds = [];
    this.quadTree = new Quad(this.border, 64, 32);
    this.startingFood();
    this.syncBots();
    if (alive) this.spawn(this.human, nick);
    this.captureView();
  };

  Game.prototype.remember = function () {
    var now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    this._simAt = now;
    for (var i = 0; i < this.nodes.length; i++) {
      var node = this.nodes[i];
      node._px = node.position.x;
      node._py = node.position.y;
      node._ps = node.size;
    }
  };

  Game.prototype.captureView = function () {
    var view = this.viewOf(this.human);
    this.viewCells = view.cells;
    this.viewSx = view.sx;
    this.viewSy = view.sy;
  };

  Game.prototype.virusCheck = function () {
    var cap = this.config.virusMaxAmount | 0;
    while (this.nodesVirus.length > cap) this.removeNode(this.nodesVirus[this.nodesVirus.length - 1]);
    if (!this.flags.virus) return;
    var needed = this.config.virusMinAmount - this.nodesVirus.length;
    if (needed <= 0) return;
    var virusMass = this.config.virusStartMass;
    var virusRadius = Math.sqrt(virusMass * 100);
    var safeGapFromEdge = 420;
    for (var i = 0; i < needed; i++) {
      var placed = false;
      for (var a = 0; a < 128; a++) {
        var pos = this.getRandomPosition();
        var tooClose = false;
        for (var j = 0; j < this.nodesPlayer.length; j++) {
          var p = this.nodesPlayer[j];
          if (p.mass < virusMass * 1.2) continue;
          var playerRadius = Math.sqrt(p.mass * 100);
          var minDist = playerRadius + virusRadius + safeGapFromEdge;
          var dx = p.position.x - pos.x;
          var dy = p.position.y - pos.y;
          if (dx * dx + dy * dy < minDist * minDist) { tooClose = true; break; }
        }
        if (!tooClose) {
          var virusId = this.allocVirusId();
          if (!virusId) break;
          this.addNode(new Virus(virusId, null, pos, virusMass, this));
          placed = true;
          break;
        }
      }
      if (!placed && this.nodesVirus.length + i < 8) {
        var virusId2 = this.allocVirusId();
        if (!virusId2) break;
        this.addNode(new Virus(virusId2, null, {
          x: 800 + Math.random() * 800,
          y: 800 + Math.random() * 800
        }, virusMass, this));
      }
    }
  };

  Game.prototype.getCellsInRange = function (cell) {
    var list = [];
    var cellSize = cell.size;
    var cellX = cell.position.x;
    var cellY = cell.position.y;
    var cellMass = cell.mass;
    var self = this;
    if (!cell.quadItem) return list;
    this.quadTree.find(cell.quadItem.bound, function (item) {
      var check = item && item.cell;
      if (!check || cell === check || check.inRange) return;
      if (cell.owner == check.owner && cell.ignoreCollision) return;
      switch (check.cellType) {
        case 2:
          if (!self.flags.eatVirus) return;
          if (check.mass * 1.33 > cellMass) return;
          break;
        case 0:
          if (check.owner == cell.owner) {
            if (!self.flags.merge) return;
            if (cell.recombineTicks > 0 || check.recombineTicks > 0) {
              if (!(cell.ignoreCollision || self.config.crazySplit)) return;
              return;
            }
            if (check.mass * 1.00 > cellMass) return;
          } else {
            if (!self.flags.eatPlayers) return;
            if (check.mass * 1.25 > cellMass) return;
          }
          if (self.haveTeams) {
            if (!check.owner) return;
            if (check.owner != cell.owner && check.owner.getTeam() == cell.owner.getTeam()) return;
          }
          break;
        default:
          if (check.cellType === 1 && !self.flags.eatFood) return;
          if (check.cellType === 3 && !self.flags.eatEject) return;
          if (check.mass * 1.25 > cellMass) return;
          break;
      }
      if (
        (check.position.x - cellX) * (check.position.x - cellX) +
        (check.position.y - cellY) * (check.position.y - cellY) >
        (cellSize - check.getEatingRange()) * (cellSize - check.getEatingRange())
      ) return;
      list.push(check);
      check.inRange = true;
    });
    return list;
  };

  Game.prototype.getNearestVirus = function (cell) {
    var r = 100;
    var topY = cell.position.y - r;
    var bottomY = cell.position.y + r;
    var leftX = cell.position.x - r;
    var rightX = cell.position.x + r;
    for (var i = 0; i < this.nodesVirus.length; i++) {
      var check = this.nodesVirus[i];
      if (!check.collisionCheck(bottomY, topY, rightX, leftX)) continue;
      return check;
    }
  };

  Game.prototype.updateMoveEngine = function () {
    var i, len, cell, cellsInRange, j, check;
    for (i = 0, len = this.nodesPlayer.length; i < len; i++) {
      cell = this.nodesPlayer[i];
      if (!cell) continue;
      if (cell.owner && cell.owner.isF5Corpse) continue;
      cell.calcMove(cell.owner.mouse.x, cell.owner.mouse.y, this);
      cellsInRange = this.getCellsInRange(cell);
      for (j = 0; j < cellsInRange.length; j++) {
        check = cellsInRange[j];
        if (!check) continue;
        check.onConsume(cell, this);
        check.setKiller(cell);
        this.removeNode(check);
      }
      if (cell.recombineTicks > 0) cell.recombineTicks--;
    }
    for (i = 0, len = this.movingNodes.length; i < len; i++) {
      check = this.movingNodes[i];
      if (!check) continue;
      if (check.moveEngineTicks > 0) {
        if (check.onAutoMove(this)) {
          i--;
          len--;
        }
        check.calcMovePhys(this);
      } else {
        check.moveDone(this);
        this.movingNodes.splice(i--, 1);
        len--;
      }
    }
  };

  Game.prototype.splitCells = function (client) {
    if (!this.flags.split) return;
    var len = client.cells.length;
    for (var i = 0; i < len; i++) {
      if (client.cells.length >= this.config.playerMaxCells) continue;
      var cell = client.cells[i];
      if (!cell || cell.mass < this.config.playerMinMassSplit) continue;
      var deltaY = client.mouse.y - cell.position.y;
      var deltaX = client.mouse.x - cell.position.x;
      var angle = Math.atan2(deltaX, deltaY);
      var size = cell.size * this.config.playerSplitSizeMult;
      var startPos = {
        x: cell.position.x + (size * Math.sin(angle)),
        y: cell.position.y + (size * Math.cos(angle))
      };
      var splitSpeed = cell.getSpeed() * this.config.playerSplitSpeedMultiplier + this.config.playerSplitSpeedAdd;
      var newMass = cell.mass / 2;
      cell.mass = newMass;
      cell.size = cell.size * 0.7071067811865476;
      var split = new PlayerCell(this.getNextNodeId(), client, startPos, newMass, this);
      split.setAngle(angle);
      split.setMoveEngineData(splitSpeed, 32, 0.85);
      split.calcMergeTime(this.config.playerRecombineTime, this.config.MegaSplit);
      if (this.config.crazySplit) split.ignoreCollision = true;
      this.setAsMovingNode(split);
      this.addNode(split);
    }
  };

  Game.prototype.ejectMass = function (client) {
    if (!this.flags.eject) return;
    for (var i = 0; i < client.cells.length; i++) {
      var cell = client.cells[i];
      if (!cell || cell.mass < this.config.playerMinMassEject) continue;
      var deltaY = client.mouse.y - cell.position.y;
      var deltaX = client.mouse.x - cell.position.x;
      var angle = Math.atan2(deltaX, deltaY);
      var size = cell.size + 5;
      var startPos = {
        x: cell.position.x + ((size + this.config.ejectMass) * Math.sin(angle)),
        y: cell.position.y + ((size + this.config.ejectMass) * Math.cos(angle))
      };
      cell.mass -= this.config.ejectMassLoss;
      cell.size = Math.ceil(Math.sqrt(100 * cell.mass));
      angle += (Math.random() * 0.4) - 0.2;
      var ejected = new EjectedMass(this.getNextNodeId(), null, startPos, this.config.ejectMass, this);
      ejected.setAngle(angle);
      ejected.setMoveEngineData(this.config.ejectSpeed, 20);
      ejected.setColor(cell.getColor ? cell.getColor() : cell.color);
      this.addNode(ejected);
      this.setAsMovingNode(ejected);
    }
  };

  Game.prototype.newCellVirused = function (client, parent, angle, mass, speed) {
    var startPos;
    if (this.config.crazySplit || this.config.MegaSplit) {
      var size = parent.size / 2;
      startPos = {
        x: parent.position.x + (size * Math.sin(angle)),
        y: parent.position.y + (size * Math.cos(angle))
      };
    } else {
      startPos = { x: parent.position.x, y: parent.position.y };
    }
    var newCell = new PlayerCell(this.getNextNodeId(), client, startPos, mass, this);
    newCell.setAngle(angle);
    newCell.setMoveEngineData(speed, 10);
    newCell.calcMergeTime(this.config.playerRecombineTime, this.config.MegaSplit);
    newCell.ignoreCollision = true;
    this.addNode(newCell);
    this.setAsMovingNode(newCell);
  };

  Game.prototype.shootVirus = function (parent) {
    var virusId = this.allocVirusId();
    if (!virusId) return;
    var virus = new Virus(virusId, null, { x: parent.position.x, y: parent.position.y }, this.config.virusStartMass, this);
    virus.setAngle(parent.getAngle());
    virus.setMoveEngineData(200, 20);
    virus.playerSplit = true;
    this.addNode(virus);
    this.setAsMovingNode(virus);
  };

  Game.prototype.cleanupVirusCluster = function (pos) {
    if (!pos) return;
    var radius = this.config.virusClusterRadius || 900;
    var maxPct = this.config.virusClusterMaxPct || 20;
    var maxLocal = Math.max(3, Math.floor((this.config.virusMaxAmount || 50) * maxPct / 100));
    var radiusSq = radius * radius;
    var nearby = [];
    for (var i = 0; i < this.nodesVirus.length; i++) {
      var v = this.nodesVirus[i];
      if (!v || !v.playerSplit) continue;
      var dx = v.position.x - pos.x;
      var dy = v.position.y - pos.y;
      if (dx * dx + dy * dy <= radiusSq) nearby.push(v);
    }
    if (nearby.length <= maxLocal) return;
    nearby.sort(function (a, b) { return a.nodeId - b.nodeId; });
    var excess = nearby.length - maxLocal;
    for (var j = 0; j < excess; j++) this.removeNode(nearby[j]);
  };

  Game.prototype.pruneDenseVirusClusters = function () {
    var checked = {};
    for (var i = 0; i < this.nodesVirus.length; i++) {
      var v = this.nodesVirus[i];
      if (!v || !v.playerSplit || checked[v.nodeId]) continue;
      var radius = this.config.virusClusterRadius || 900;
      var radiusSq = radius * radius;
      for (var j = 0; j < this.nodesVirus.length; j++) {
        var o = this.nodesVirus[j];
        if (!o || !o.playerSplit) continue;
        var dx = o.position.x - v.position.x;
        var dy = o.position.y - v.position.y;
        if (dx * dx + dy * dy <= radiusSq) checked[o.nodeId] = true;
      }
      this.cleanupVirusCluster(v.position);
    }
  };

  Game.prototype.cleanupEjectCluster = function (pos) {
    if (!pos) return;
    var radius = this.config.ejectClusterRadius || 180;
    var maxLocal = this.config.ejectClusterMax || 35;
    var radiusSq = radius * radius;
    var nearby = [];
    for (var i = 0; i < this.nodesEjected.length; i++) {
      var ejected = this.nodesEjected[i];
      if (!ejected) continue;
      var dx = ejected.position.x - pos.x;
      var dy = ejected.position.y - pos.y;
      if (dx * dx + dy * dy <= radiusSq) nearby.push(ejected);
    }
    if (nearby.length <= maxLocal) return;
    nearby.sort(function (a, b) { return a.nodeId - b.nodeId; });
    for (var j = 0; j < nearby.length - maxLocal; j++) this.removeNode(nearby[j]);
  };

  Game.prototype.updateCells = function () {
    if (!this.run || !this.flags.decay) return;
    var massDecay = 1 - (this.config.playerMassDecayRate * this.decayMod);
    for (var i = 0; i < this.nodesPlayer.length; i++) {
      var cell = this.nodesPlayer[i];
      if (cell.mass >= this.config.playerMinMassDecay) {
        cell.mass *= massDecay;
        cell.size = Math.pow(100 * cell.mass, 0.5);
      }
    }
  };

  Game.prototype.updateLB = function () {
    var living = [];
    for (var i = 0; i < this.clients.length; i++) {
      var player = this.clients[i] && this.clients[i].playerTracker;
      if (!player) continue;
      if (player.cells.length <= 0) {
        player.lbRank = 0;
        continue;
      }
      player.getScore(true);
      living.push(player);
    }
    living.sort(function (a, b) { return b.getScore(false) - a.getScore(false); });
    for (var r = 0; r < living.length; r++) living[r].lbRank = r + 1;
    this.leaderboard = living.slice(0, 10);
  };

  Game.prototype.step = function () {
    this.simTick();
    this.flush();
  };

  Game.prototype.simTick = function () {
    this.remember();
    if (this.run) {
      this.rotateFoodIds();
      this.rotateVirusIds();
      this.updateMoveEngine();
      this.tickSpawn++;
      if (this.tickSpawn >= this.config.spawnInterval) {
        this.updateFood();
        this.virusCheck();
        this.pruneDenseVirusClusters();
        this.tickSpawn = 0;
      }
      for (var q = 0; q < this.nodes.length; q++) this.updateNodeQuad(this.nodes[q]);
    }
    this.tickMain++;
    if (this.tickMain >= 50) {
      this.updateCells();
      this.updateLB();
      this.tickMain = 0;
    }
    var players = 0;
    for (var c = 0; c < this.clients.length; c++) {
      var tracker = this.clients[c] && this.clients[c].playerTracker;
      if (tracker && !tracker.spectate) players++;
    }
    if (this.flags.bots && players < (this.config.serverBots | 0)) this.addBot();
    this.captureView();
    this.tick++;
  };

  Game.prototype.flush = function () {
    this.applyActions();
    for (var b = 0; b < this.clients.length; b++) {
      var bot = this.clients[b] && this.clients[b].playerTracker;
      if (!bot || !bot.isBot) continue;
      try { bot.update(); } catch (err) {}
    }
  };

  Game.prototype.applyActions = function () {
    var human = this.human;
    if (!human || !human.cells.length) return;
    var now = Date.now();
    if ((this.input.split || this.input.splitArm) && now - this.input.lastSpace >= 80) {
      this.splitCells(human);
      this.input.lastSpace = now;
      this.input.splitArm = false;
    }
    if ((this.input.eject || this.input.ejectArm) && now - this.input.lastEject >= 80) {
      this.ejectMass(human);
      this.input.lastEject = now;
      this.input.ejectArm = false;
    }
  };

  Game.prototype.start = function () {
    var self = this;
    if (this._timer) return;
    this._nextAt = Date.now() + this.tickMs();
    var pump = function () {
      if (!self._timer && self._stopped) return;
      var tickMs = self.tickMs();
      var now = Date.now();
      var steps = 1;
      if (now > self._nextAt) steps += Math.floor((now - self._nextAt) / tickMs);
      var maxSteps = self.config.netMaxCatchupTicks | 0;
      if (maxSteps <= 0) maxSteps = 1;
      if (steps > maxSteps) {
        self._nextAt = now;
        steps = 1;
      }
      for (var s = 0; s < steps; s++) {
        self.simTick();
        self._nextAt += tickMs;
      }
      self.flush();
      var delay = self._nextAt - Date.now();
      if (delay < 0) delay = 0;
      if (delay > tickMs) delay = tickMs;
      self._timer = setTimeout(pump, delay);
    };
    this._stopped = false;
    this._timer = setTimeout(pump, this.tickMs());
  };

  Game.prototype.viewOf = function (player) {
    var cells, cx, cy, sx, sy;
    if (player.cells.length > 0) {
      cells = player.calcViewBox();
      cx = player.centerPos.x;
      cy = player.centerPos.y;
      sx = player.sightRangeX;
      sy = player.sightRangeY;
      for (var i = 0; i < player.cells.length; i++) {
        if (cells.indexOf(player.cells[i]) === -1) cells.push(player.cells[i]);
      }
    } else {
      sx = this.config.serverViewBaseX * 2.4;
      sy = this.config.serverViewBaseY * 2.4;
      cx = 0;
      cy = 0;
      cells = [];
      this.quadTree.find({
        minx: -sx, miny: -sy, maxx: sx, maxy: sy
      }, function (item) { if (item && item.cell) cells.push(item.cell); });
    }
    return { cells: cells, x: cx, y: cy, sx: sx, sy: sy };
  };

  function createGame() {
    if (!Quad && typeof require !== 'undefined') Quad = require('./quad.js');
    if (!Quad) throw new Error('QuadNode missing');
    return new Game();
  }

  var api = { createGame: createGame, parseIni: parseIni };
  root.OfflinePhysics = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
