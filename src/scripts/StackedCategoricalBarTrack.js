import {scaleLinear, scaleOrdinal, schemeCategory10} from 'd3-scale';

const StackedCategoricalBarTrack = (HGC, ...args) => {
  if (!new.target) {
    throw new Error(
      'Uncaught TypeError: Class constructor cannot be invoked without "new"',
    );
  }

  // Services
  const { tileProxy } = HGC.services;
  
  //console.log("tileProxy", tileProxy);

  // Utils
  const { colorToHex } = HGC.utils;

  class StackedCategoricalBarTrackClass extends HGC.tracks.BarTrack {
    constructor(context, options) {
      super(context, options);


      this.maxAndMin = {
        max: null,
        min: null
      };

    }

    initTile(tile) {
      // create the tile
      // should be overwritten by child classes
      this.scale.minRawValue = this.minVisibleValue();
      this.scale.maxRawValue = this.maxVisibleValue();

      this.scale.minValue = this.scale.minRawValue;
      this.scale.maxValue = this.scale.maxRawValue;

      this.maxAndMin.max = this.scale.maxValue;
      this.maxAndMin.min = this.scale.minValue;

      //console.log('initTile:', tile.tileId, this.maxAndMin);
      // tile.minValue = this.scale.minValue;

      this.localColorToHexScale();

      this.unFlatten(tile);

      this.renderTile(tile);
      this.rescaleTiles();
    }


    rerender(newOptions) {
      super.rerender(newOptions);

      this.options = newOptions;
      const visibleAndFetched = this.visibleAndFetchedTiles();

      for (let i = 0; i < visibleAndFetched.length; i++) {
        this.updateTile(visibleAndFetched[i]);
      }

      this.rescaleTiles();
    }

    updateTile() {
      const visibleAndFetched = this.visibleAndFetchedTiles();

      for (let i = 0; i < visibleAndFetched.length; i++) {
        const tile = visibleAndFetched[i];
        this.unFlatten(tile);
      }

      this.rescaleTiles();
    }
    /**
     * Draws exactly one tile.
     *
     * @param tile
     */
    renderTile(tile) {
      tile.svgData = null;
      tile.mouseOverData = null;

      const graphics = tile.graphics;
      graphics.clear();
      graphics.children.map(child => {graphics.removeChild(child)});
      tile.drawnAtScale = this._xScale.copy();

      // we're setting the start of the tile to the current zoom level
      const {tileX, tileWidth} = this.getTilePosAndDimensions(tile.tileData.zoomLevel, tile.tileData.tilePos, this.tilesetInfo.tile_size);

      const matrix = this.unFlatten(tile);

      this.oldDimensions = this.dimensions; // for mouseover

      // creates a sprite containing all of the rectangles in this tile
      this.drawVerticalBars(this.mapOriginalColors(matrix), tileX, tileWidth, this.maxAndMin.max, this.maxAndMin.min, tile);

      // console.log('tile.sprite', tile.sprite.x, tile.sprite.y, tile.sprite.scale.x, tile.sprite.scale.y)
      //console.log('this.maxAndMin', this.maxAndMin);

      graphics.addChild(tile.sprite);
      this.makeMouseOverData(tile);
    }

    syncMaxAndMin() {
      const visibleAndFetched = this.visibleAndFetchedTiles();

      visibleAndFetched.map(tile => {
        // console.log('tile:', tile.tileId, tile.minValue, tile.maxValue);

        if (tile.minValue + tile.maxValue > this.maxAndMin.min + this.maxAndMin.max) {
          this.maxAndMin.min = tile.minValue;
          this.maxAndMin.max = tile.maxValue;
        }
          // if (!(this.maxAndMin && this.maxAndMin.min && this.maxAndMin.min < tile.minValue)) {
          //   this.maxAndMin.min = tile.minValue;
          // }

          // if (!(this.maxAndMin && this.maxAndMin.max && this.maxAndMin.max > tile.maxValue)) {
          //   this.maxAndMin.max = tile.maxValue;
          // }
        // console.log('this.maxAndMin:', this.maxAndMin);
      });
    }

    /**
     * Rescales the sprites of all visible tiles when zooming and panning.
     */
    rescaleTiles() {
      // console.log('rescale:')
      const visibleAndFetched = this.visibleAndFetchedTiles();

      this.syncMaxAndMin();

      // console.log('maxAndMin:', this.maxAndMin);

      visibleAndFetched.map(a => {
        const valueToPixels = scaleLinear()
          .domain([0, this.maxAndMin.max + Math.abs(this.maxAndMin.min)])
          .range([0, this.dimensions[1]]);
        const newZero = this.dimensions[1] - valueToPixels(Math.abs(this.maxAndMin.min));
        const height = valueToPixels(a.minValue + a.maxValue);
        const sprite = a.sprite;
        const y = newZero - valueToPixels(a.maxValue);

        if (sprite) {
          sprite.height = height;

          sprite.y = y;
        }
      });
    }


    /**
     * Converts all colors in a colorScale to Hex colors.
     */
    localColorToHexScale() {
      const colorScale = this.options.colorScale || scaleOrdinal(schemeCategory10);
      const colorHexMap = {};
      for (let i = 0; i < colorScale.length; i++) {
        colorHexMap[colorScale[i]] = colorToHex(colorScale[i]);
      }
      this.colorHexMap = colorHexMap;
    }

    /**
     * Find max and min heights for the given tile
     *
     * @param matrix 2d array of numbers representing one tile
     */
    findMaxAndMin(matrix) {
      // find max height of bars for scaling in the track
      const maxAndMin = {
        max: null,
        min: null
      };

      for (let i = 0; i < matrix.length; i++) {
        const temp = matrix[i];
        const localPositiveMax = temp.length;
        if (localPositiveMax > maxAndMin.max) {
          maxAndMin.max = localPositiveMax;
        }
      }
      maxAndMin.min = 0;

      return maxAndMin;
    }


      /**
       * un-flatten data into matrix of tile.tileData.shape[0] x tile.tileData.shape[1]
       *
       * @param tile
       * @returns {Array} 2d array of numerical values for each column
       */
      unFlatten(tile) {
        if (tile.matrix) {
          return tile.matrix;
        }

        const flattenedArray = tile.tileData.dense;

        // if any data is negative, switch to exponential scale
        if (flattenedArray.filter(a => a < 0).length > 0 && this.options.valueScaling === 'linear') {
          console.warn('Negative values present in data. Defaulting to exponential scale.');
          this.options.valueScaling = 'exponential';
        }

        const matrix = this.simpleUnFlatten(tile, flattenedArray);

        const maxAndMin = this.findMaxAndMin(matrix);
        //console.log('unflatten', tile.tileId, maxAndMin.min, maxAndMin.max);

        tile.matrix = matrix;
        tile.maxValue = maxAndMin.max;
        tile.minValue = maxAndMin.min;

        this.syncMaxAndMin();

        return matrix;
      }

      /**
       *
       * @param tile
       * @param data array of values to reshape
       * @returns {Array} 2D array representation of data
       */
      simpleUnFlatten(tile, data) {
        const shapeX = tile.tileData.shape[0]; // number of different nucleotides in each bar
        const shapeY = tile.tileData.shape[1]; // number of bars

        // matrix[0] will be [flattenedArray[0], flattenedArray[256], flattenedArray[512], etc.]
        // because of how flattenedArray comes back from the server.
        const matrix = [];
        for (let i = 0; i < shapeX; i++) { // 6
          for (let j = 0; j < shapeY; j++) { // 256;
            let singleBar;
            if (matrix[j] === undefined) {
              singleBar = [];
            } else {
              singleBar = matrix[j];
            }
            singleBar.push(data[(shapeY * i) + j]);
            matrix[j] = singleBar;
          }
        }

        return matrix;
      }


    /**
     * Map each value in every array in the matrix to a color depending on categorical value stored in the array
     *
     * @param matrix 2d array of numbers representing nucleotides
     * @return
     */
    mapOriginalColors(matrix) {
      const colorScale = this.options.colorScale || scaleOrdinal(schemeCategory10);

      // mapping colors to unsorted values
      const matrixWithColors = [];
      for (let j = 0; j < matrix.length; j++) {
        const columnColors = [];
        for (let i = 0; i < matrix[j].length; i++) {
          columnColors[i] = {
            value: isNaN(matrix[j][i]) ? 0 : matrix[j][i],
            color: isNaN(matrix[j][i]) ? 0 : colorScale[matrix[j][i] - 1]
          }
        }
        const values = [];
        for (let i = 0; i < columnColors.length; i++) {
          if (columnColors[i].value >= 0) {
            values.push(columnColors[i]);
          }
        }
        matrixWithColors.push([values]);
      }
      
      return matrixWithColors;
    }

    /**
     * Draws graph without normalizing values.
     *
     * @param graphics PIXI.Graphics instance
     * @param matrix 2d array of numbers representing nucleotides
     * @param tileX starting position of tile
     * @param tileWidth pre-scaled width of tile
     * @param positiveMax the height of the tallest bar in the positive part of the graph
     * @param negativeMax the height of the tallest bar in the negative part of the graph
     * @param tile
     */
    drawVerticalBars(matrix, tileX, tileWidth, positiveMax, negativeMax, tile) {
      let graphics = new PIXI.Graphics();
      const trackHeight = this.dimensions[1];
      //console.log('drawing vertical:', trackHeight, positiveMax, negativeMax);

      // get amount of trackHeight reserved for positive and for negative
      const unscaledHeight = positiveMax + (Math.abs(negativeMax));

      // fraction of the track devoted to values
      const positiveTrackHeight = (positiveMax * trackHeight) / unscaledHeight;

      //console.log('positiveTrackHeight', tile.tileId, positiveTrackHeight);

      let start = null;
      let lowestY = this.dimensions[1];

      const width = 10;

      // calls drawBackground in PixiTrack.js
      this.drawBackground(matrix, graphics);

      // borders around each bar
      if (this.options.barBorder) {
        graphics.lineStyle(1, 0x000000, 1);
      }

      for (let j = 0; j < matrix.length; j++) { // jth vertical bar in the graph
        const x = (j * width);
        (j === 0) ? start = x : start;

        // draw values with a constant height
        const constantHeight = 1;
        const positive = matrix[j][0];
        const valueToPixelsPositive = scaleLinear()
          .domain([0, positiveMax])
          .range([0, positiveTrackHeight]);
        let positiveStackedHeight = 0;
        for (let i = 0; i < positive.length; i++) {
          //const height = valueToPixelsPositive(positive[i].value);
          const height = valueToPixelsPositive(constantHeight);
          //const y = positiveTrackHeight - (positiveStackedHeight + height);
          // reverse the vertical order of cells
          const y = positiveStackedHeight - positiveTrackHeight;
          this.addSVGInfo(tile, x, y, width, height, positive[i].color);
          graphics.beginFill(this.colorHexMap[positive[i].color]);
          graphics.drawRect(x, y, width, height);
          positiveStackedHeight = positiveStackedHeight + height;
          if (lowestY > y)
            lowestY = y;
        }
      }

      // vertical bars are drawn onto the graphics object and a texture is generated from that
      const texture = graphics.generateTexture(PIXI.SCALE_MODES.NEAREST);
      const sprite = new PIXI.Sprite(texture);
      sprite.width = this._xScale(tileX + tileWidth) - this._xScale(tileX);
      sprite.x = this._xScale(tileX);
      tile.sprite = sprite;
      tile.lowestY = lowestY;
      // console.log('new lowestY:', tile.tileId, lowestY, tile.svgData);;
    }

    /**
     * Adds information to recreate the track in SVG to the tile
     *
     * @param tile
     * @param x x value of bar
     * @param y y value of bar
     * @param width width of bar
     * @param height height of bar
     * @param color color of bar (not converted to hex)
     */
    addSVGInfo(tile, x, y, width, height, color) {
      if (tile.hasOwnProperty('svgData') && tile.svgData !== null) {
        tile.svgData.barXValues.push(x);
        tile.svgData.barYValues.push(y);
        tile.svgData.barWidths.push(width);
        tile.svgData.barHeights.push(height);
        tile.svgData.barColors.push(color);
      }
      else {
        tile.svgData = {
          barXValues: [x],
          barYValues: [y],
          barWidths: [width],
          barHeights: [height],
          barColors: [color]
        };
      }
    }

    /**
     * Here, rerender all tiles every time track size is changed
     *
     * @param newDimensions
     */
    setDimensions(newDimensions) {
      this.oldDimensions = this.dimensions;
      super.setDimensions(newDimensions);

      const visibleAndFetched = this.visibleAndFetchedTiles();
      visibleAndFetched.map(a => this.initTile(a));
    }

    /**
     * Sorts relevant data for mouseover for easy iteration later
     *
     * @param tile
     */
    makeMouseOverData(tile) {
      const shapeX = tile.tileData.shape[0]; // 15 number of different nucleotides in each bar
      const shapeY = tile.tileData.shape[1]; // 3840 number of bars
      const barYValues = tile.svgData.barYValues;
      const barHeights = tile.svgData.barHeights;
      const barColors = tile.svgData.barColors;
      let mouseOverData = [];

      // console.log('barHeights:', barHeights);

      for (let i = 0; i < shapeX; i++) {
        for (let j = 0; j < shapeY; j++) {
          const index = (j * shapeX) + i;
          let dataPoint = {
            y: barYValues[index],
            height: barHeights[index],
            color: barColors[index]
          };
          (mouseOverData[j] === undefined) ? mouseOverData[j] = [dataPoint]
            : mouseOverData[j].push(dataPoint);
        }
      }
      for (let i = 0; i < mouseOverData.length; i++) {
        mouseOverData[i] = mouseOverData[i].sort((a, b) => {
          return a.y - b.y
        });
      }

      tile.mouseOverData = mouseOverData;

    }

    /**
     * Realigns tiles when exporting to SVG
     */
     /*
    realignSVG() {
      const visibleAndFetched = this.visibleAndFetchedTiles();

      visibleAndFetched.map(tile => {
        const valueToPixels = scaleLinear()
          .domain([0, this.maxAndMin.max + Math.abs(this.maxAndMin.min)])
          .range([0, this.dimensions[1]]);
        const newZero = this.dimensions[1] - valueToPixels(Math.abs(this.maxAndMin.min));
        const realignment = newZero - valueToPixels(tile.maxValue);
        tile.svgData.barYValues = tile.svgData.barYValues.map(yVal => { return yVal - realignment});
      });
    }
    */

    exportSVG() {
      const visibleAndFetched = this.visibleAndFetchedTiles();
      visibleAndFetched.map((tile) => {
        this.initTile(tile);
        this.draw();
      });

      let track = null;
      let base = null;

      base = document.createElement('g');
      track = base;

      [base, track] = super.superSVG();

      const output = document.createElement('g');
      track.appendChild(output);

      output.setAttribute(
        'transform',
        `translate(${this.pMain.position.x},${this.pMain.position.y}) scale(${this.pMain.scale.x},${this.pMain.scale.y})`,
      );

      // this.realignSVG();

      for (const tile of this.visibleAndFetchedTiles()) {
        const rotation = 0;
        const g = document.createElement('g');



        // place each sprite
        g.setAttribute(
          'transform',
          ` translate(${tile.sprite.x},${tile.sprite.y}) rotate(${rotation}) scale(${tile.sprite.scale.x},${tile.sprite.scale.y}) `,
        );

        const data = tile.svgData;

        // add each bar
        for (let i = 0; i < data.barXValues.length; i++) {
          const rect = document.createElement('rect');
          rect.setAttribute('fill', data.barColors[i]);
          rect.setAttribute('stroke', data.barColors[i]);

          rect.setAttribute('x', data.barXValues[i]);
          rect.setAttribute('y', data.barYValues[i] - tile.lowestY);
          rect.setAttribute('height', data.barHeights[i]);
          rect.setAttribute('width', data.barWidths[i]);
          if (tile.barBorders) {
            rect.setAttribute('stroke-width', '0.1');
            rect.setAttribute('stroke', 'black');
          }

          g.appendChild(rect);
        }

        output.appendChild(g);
      }

      return [base, base];
    }

    /**
     * Shows value and type for each bar
     *
     * @param trackX x coordinate of mouse
     * @param trackY y coordinate of mouse
     * @returns string with embedded values and svg square for color
     */
    getMouseOverHtml(trackX, trackY) {
      if (!this.tilesetInfo)
        return '';

      const colorScale = this.options.colorScale || scaleOrdinal(schemeCategory10);

      const zoomLevel = this.calculateZoomLevel();
      const tileWidth = tileProxy.calculateTileWidth(this.tilesetInfo,
        zoomLevel,
        this.tilesetInfo.tile_size);

      // the position of the tile containing the query position
      const tilePos = this._xScale.invert(trackX) / tileWidth;

      const posInTileX = Math.floor(this.tilesetInfo.tile_size * (tilePos - Math.floor(tilePos)));

      const tileId = this.tileToLocalId([zoomLevel, Math.floor(tilePos)]);
      const fetchedTile = this.fetchedTiles[tileId];

      if (!fetchedTile)
        return '';

      const matrixRow = fetchedTile.matrix[posInTileX];
      let row = fetchedTile.mouseOverData[posInTileX];

      // console.log('matrixRow:', matrixRow);

      const dataY = ((trackY - fetchedTile.sprite.y)
        / fetchedTile.sprite.scale.y) + fetchedTile.lowestY;

      // console.log('trackX:', trackX, 'trackY:', trackY, 'tilePos:',
      //   tilePos, 'posInTileX', posInTileX);
      // console.log('matrixRow:', matrixRow);

      // const dataY1 = dataY + fetchedTile.lowestY;
      // console.log('dataY', dataY, 'dataY1', dataY1);
      // console.log('fetchedTile:', fetchedTile);
      // console.log('trackY:', trackY, 'lowestY:', fetchedTile.lowestY);

      // row = this.scaleRow(row);

      //use color to map back to the array index for correct data
      const colorScaleMap = {};
      for (let i = 0; i < colorScale.length; i++) {
        colorScaleMap[colorScale[i]] = i;
      }

      // // if mousing over a blank area
      if (dataY < row[0].y || dataY
        >= (row[row.length - 1].y + row[row.length - 1].height)) {
        return '';
      }
      else {
        for (let i = 0; i < row.length; i++) {
          const y = row[i].y;
          const height = row[i].height;
          if (dataY > y && dataY <= (y + height)) {
            const color = row[i].color;
            //const value = Number.parseFloat(matrixRow[colorScaleMap[color]]).toPrecision(4).toString();
            //const md = (this.tilesetInfo.row_infos) ? JSON.parse(this.tilesetInfo.row_infos[i]) : "NA";
            //const label = md.name + ' | ' + md.description;
            //console.log("color, colorScaleMap[color]", color, colorScaleMap[color]);
            const label = (this.tilesetInfo.row_infos) ? this.tilesetInfo.row_infos[i] : "NA";
            //console.log("this.tilesetInfo", this.tilesetInfo);
            //const category = (this.tilesetInfo.category_infos) ? this.tilesetInfo.category_infos[colorScaleMap[color]] : "NA";

            //return `<svg width="10" height="10"><rect width="10" height="10" rx="2" ry="2"
            //style="fill:${color};stroke:black;stroke-width:2;"></svg>`
            //  + ` ${label}` + `<br>` + `${category}`;
            
            return `<svg width="10" height="10"><rect width="10" height="10" rx="2" ry="2"
            style="fill:${color};stroke:black;stroke-width:2;"></svg>`
              + ` ${label}`;

          }
        }
      }

    }

    draw() {
      super.draw();
    }

  }
  return new StackedCategoricalBarTrackClass(...args);
};

const icon = '<svg id="Layer_1" data-name="Layer 1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 564 542"><defs><style>.cls-1{fill:#006400;}.cls-2{fill:green;}.cls-3{fill:#32cd32;}.cls-4{fill:red;}.cls-5{fill:#c2e105;}.cls-6{fill:#66cdaa;}.cls-7{fill:#ff4500;}</style></defs><title>icon</title><path d="M0,271V0H564V542H0Z"/><path class="cls-1" d="M429.57,75.08V18.44h115V131.72h-115Z"/><path class="cls-1" d="M294.07,75.08V18.44h115V131.72h-115Z"/><path class="cls-1" d="M157.59,76V19.38h117V132.66h-117Z"/><path class="cls-1" d="M20.83,76.29V19.65H138.39V132.93H20.83Z"/><path class="cls-2" d="M429.35,203.89V147.25h115V260.53h-115Z"/><path class="cls-3" d="M293.85,203.89V147.25h115V260.53h-115Z"/><path class="cls-4" d="M20.61,205.1V148.46H138.17V261.74H20.61Z"/><path class="cls-2" d="M429.35,333.92V277.28h115V390.55h-115Z"/><path class="cls-3" d="M293.85,333.92V277.28h115V390.55h-115Z"/><path class="cls-5" d="M429.35,465.4V408.76h115V522h-115Z"/><path class="cls-5" d="M293.85,465.4V408.76h115V522h-115Z"/><path class="cls-6" d="M157.38,466.34V409.7h117V523h-117Z"/><path class="cls-6" d="M20.61,466.36V409.72H138.17V523H20.61Z"/><path class="cls-7" d="M157.32,205.1V148.46H274.88V261.74H157.32Z"/><path class="cls-7" d="M157.32,335.13V278.49H274.88V391.76H157.32Z"/><path class="cls-4" d="M20.83,335.73V279.09H138.39V392.37H20.83Z"/></svg>';

// default
StackedCategoricalBarTrack.config = {
  type: 'horizontal-categorical-stacked-bar',
  datatype: ['multivec'],
  local: false,
  orientation: '1d-horizontal',
  thumbnail: new DOMParser().parseFromString(icon, 'text/xml').documentElement,
  availableOptions: ['labelPosition', 'labelColor', 'valueScaling',
    'labelTextOpacity', 'labelBackgroundOpacity', 'trackBorderWidth',
    'trackBorderColor', 'trackType', 'scaledHeight', 'backgroundColor',
    'colorScale', 'barBorder'],
  defaultOptions: {
    labelPosition: 'hidden',
    labelColor: 'black',
    labelTextOpacity: 0.4,
    valueScaling: 'linear',
    trackBorderWidth: 0,
    trackBorderColor: 'black',
    backgroundColor: 'black',
    barBorder: false,
    colorScale: [
      "#FF0000",
      "#FF4500",
      "#32CD32",
      "#008000",
      "#006400",
      "#C2E105",
      "#FFFF00",
      "#66CDAA",
      "#8A91D0",
      "#CD5C5C",
      "#E9967A",
      "#BDB76B",
      "#808080",
      "#C0C0C0",
      "#FFFFFF"
    ],
  },
  otherOptions: {
  }
};


export default StackedCategoricalBarTrack;
