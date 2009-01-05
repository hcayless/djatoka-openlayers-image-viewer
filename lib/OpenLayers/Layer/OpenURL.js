/* Copyright (c) Hugh A. Cayless, published under the Clear BSD
 * licence.  See http://svn.openlayers.org/trunk/openlayers/license.txt for the
 * full text of the license. */


/**
 * @requires OpenLayers/Layer/Grid.js
 * @requires OpenLayers/Tile/Image.js
 */

/**
 * Class: OpenLayers.Layer.OpenURL
 * 
 * Inherits from:
 *  - <OpenLayers.Layer.Grid>
 */
OpenLayers.Layer.OpenURL = OpenLayers.Class(OpenLayers.Layer.Grid, {

    /**
     * APIProperty: isBaseLayer
     * {Boolean}
     */
    isBaseLayer: true,

    /**
     * APIProperty: tileOrigin
     * {<OpenLayers.Pixel>}
     */
    tileOrigin: null,
    
    url_ver: 'Z39.88-2004',
    rft_id: null,
    svc_id: "info:lanl-repo/svc/getRegion",
    svc_val_fmt: "info:ofi/fmt:kev:mtx:jpeg2000",
    format: null,
    tileHeight: null,

    /**
     * Constructor: OpenLayers.Layer.OpenURL
     * 
     * Parameters:
     * name - {String}
     * url - {String}
     * options - {Object} Hashtable of extra options to tag onto the layer
     */
    initialize: function(name, url, options) {
        var newArguments = [];
        newArguments.push(name, url, {}, options);
        OpenLayers.Layer.Grid.prototype.initialize.apply(this, newArguments);
        this.rft_id = options.rft_id;
        this.format = options.format;
        // Get image metadata
        var request = OpenLayers.Request.issue({url: options.metadataUrl, async: false});
        this.imgMetadata = eval('(' + request.responseText + ')');
        
        // Determine optimal tile size for the viewer
        var l = this.imgMetadata.levels;
        var w = this.imgMetadata.width / Math.pow(2, l);
        if (w < 40) {
          l--;
          var w = this.imgMetadata.width / Math.pow(2, l);
        }
        var h = this.imgMetadata.height / Math.pow(2, l);
        this.zoomOffset = 0;
        while ((this.imgMetadata.width / Math.pow(2, l-1)) < 512 && (this.imgMetadata.height / Math.pow(2, l-1)) < 512) {
          l--;
          this.zoomOffset++;
          w = this.imgMetadata.width / Math.pow(2, l);
          h = this.imgMetadata.height / Math.pow(2, l);
        }
        this.resolutions = new Array();
        var max = this.imgMetadata.width / w;
        var level = max;
        for (i = 0; i <= l; i++) {
          this.resolutions.push(level);
          level = level / 2;
        }
        
        this.tileSize = new OpenLayers.Size(Math.ceil(w), Math.ceil(h));
    },    

    /**
     * APIMethod:destroy
     */
    destroy: function() {
        // for now, nothing special to do here. 
        OpenLayers.Layer.Grid.prototype.destroy.apply(this, arguments);  
    },

    
    /**
     * APIMethod: clone
     * 
     * Parameters:
     * obj - {Object}
     * 
     * Returns:
     * {<OpenLayers.Layer.OpenURL>} An exact clone of this <OpenLayers.Layer.OpenURL>
     */
    clone: function (obj) {
        
        if (obj == null) {
            obj = new OpenLayers.Layer.OpenURL(this.name,
                                           this.url,
                                           this.options);
        }

        //get all additions from superclasses
        obj = OpenLayers.Layer.Grid.prototype.clone.apply(this, [obj]);

        // copy/set any non-init, non-simple values here

        return obj;
    },    
    
    /**
     * Method: getURL
     * 
     * Parameters:
     * bounds - {<OpenLayers.Bounds>}
     * 
     * Returns:
     * {String} A string with the layer's url and parameters and also the 
     *          passed-in bounds and appropriate tile size specified as 
     *          parameters
     */
    getURL: function (bounds) {  
        bounds = this.adjustBounds(bounds);    
        // Have to recalculate x and y (instead of using bounds and resolution), because resolution will be slightly off.
        // Get number of tiles in image
        var xtiles = Math.round( 1 / (this.tileSize.w / this.map.getMaxExtent().getWidth()));
        // Find out which tile we're on
        var xpos = Math.round((bounds.left / this.map.getMaxExtent().getWidth()) * xtiles);
        // Set x
        var x = xpos * (this.tileSize.w + 1);
        // Do the same for y
        var ytiles = Math.round( 1 / (this.tileSize.h / this.map.getMaxExtent().getHeight()));
        // Djatoka's coordinate system is top-down, not bottom-up, so invert for y
        var y = this.map.getMaxExtent().getHeight() - bounds.top;
        y = y < 0? 0 : y;
        var ypos = Math.round((y / this.map.getMaxExtent().getHeight()) * ytiles);
        var y = ypos * (this.tileSize.h + 1);
        
        var z = this.map.getZoom() + this.zoomOffset;
        var h = this.tileSize.h;
        var w = this.tileSize.w;
        var path = "/adore-djatoka/resolver?url_ver=" + this.url_ver + "&rft_id=" + this.rft_id +
        "&svc_id=" + this.svc_id + "&svc_val_fmt=" + this.svc_val_fmt + "&svc.format=" + this.format
        + "&svc.level="+z+"&svc.rotate=0&svc.region=" + y + "," + x + "," + h +
        "," + w;
        var url = this.url;
        if (url instanceof Array) {
            url = this.selectUrl(path, url);
        }
        return url + path;
    },

    /**
     * Method: addTile
     * addTile creates a tile, initializes it, and adds it to the layer div. 
     * 
     * Parameters:
     * bounds - {<OpenLayers.Bounds>}
     * position - {<OpenLayers.Pixel>}
     * 
     * Returns:
     * {<OpenLayers.Tile.Image>} The added OpenLayers.Tile.Image
     */
    addTile:function(bounds,position) {
      var size = new OpenLayers.Size(Math.ceil(this.tileSize.w), Math.ceil(this.tileSize.h));
        return new OpenLayers.Tile.Image(this, position, bounds, 
                                         null, size);
    },

    /** 
     * APIMethod: setMap
     * When the layer is added to a map, then we can fetch our origin 
     *    (if we don't have one.) 
     * 
     * Parameters:
     * map - {<OpenLayers.Map>}
     */
    setMap: function(map) {
        OpenLayers.Layer.Grid.prototype.setMap.apply(this, arguments);
        if (!this.tileOrigin) { 
            this.tileOrigin = new OpenLayers.LonLat(this.map.maxExtent.left,
                                                this.map.maxExtent.bottom);
        }                                       
    },
    
    getImageMetadata: function() {
      return this.imgMetadata;
    },
    
    getResolutions: function() {
      return this.resolutions;
    },
    
    getTileSize: function() {
      return this.tileSize;
    },

    CLASS_NAME: "OpenLayers.Layer.OpenURL"
});
