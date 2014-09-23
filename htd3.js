'use strict';

var htd3 = (function () {
  var graphs = {};


  // visualisation of associations between regions
  graphs.associations = (function () {
    var priv = {},
        trackOffset = 0,
        settings = {
          colors: {
            score: ['red', 'black', 'green']
          },
          legendHeight: 20,
          trackHeight: 15,
          linkRadiusRatio: 0.8,
          width: 800,
          paddingX: 50,
          paddingY: 50,
          paddingTick: 15
        };

    // private functions
    priv.draw = {
      legend: function (selection) {
        var legend = selection.append('g').attr('class', 'legend'),
            gradient = legend.append('defs').append('linearGradient').attr('id', 'legendGradient'),
            node,
            offset = 0,
            legendPadding = 4;

        for (var i=0; i <= settings.colors.score.length; i++) {
          var percent = i/settings.colors.score.length;
          gradient.append('stop')
            .attr('offset', (100*percent) + '%')
            .attr('stop-color', priv.scale.linkColor(percent) );
        };

        node = legend.append('text')
          .text(d3.min(self.data.scores))
          .attr('dominant-baseline', 'middle')
          .attr('x', legendPadding)
          .attr('y', settings.legendHeight / 2);
        offset += node.node().getBBox().width + legendPadding * 2;

        node = legend.append('rect')
          .attr('fill', 'url(#legendGradient)')
          .attr('height', settings.legendHeight)
          .attr('width', 100)
          .attr('x', offset);
        offset += node.node().getBBox().width + legendPadding;

        legend.append('text')
          .text(d3.max(self.data.scores))
          .attr('dominant-baseline', 'middle')
          .attr('x', offset)
          .attr('y', settings.legendHeight / 2);
      },

      // draw track with all associations
      track: function (d, i) {
        var context = d3.select(this),
            computedHeight,
            y;

        // draw track
        context.append('rect')
          .attr('height', settings.trackHeight)
          .attr('width', '100%')
          .attr('class', 'base')
          .attr('title', d.key);

        // append track name
        context.append('text')
          .text(d.key)
          .attr('font-size', settings.trackHeight * 0.8)
          .attr('dominant-baseline', 'middle')
          .attr('x', 3)
          .attr('y', settings.trackHeight / 2);

        // draw regions for this track
        d.values.forEach( function (i) { priv.draw.association(context, i); } );

        // adjust vertical position based on computed track height
        computedHeight = context.node().getBBox().y;
        y = -computedHeight + trackOffset + settings.paddingY;
        context.attr('transform', 'translate(0,'+ y +')');
        trackOffset = y;
      },

      // generate link path
      link: function (d) {
        var left = d.target,
            right = d.source,
            ry = settings.linkRadiusRatio;

        // swap target and source to simplify drawing
        if (d.source.x0 < d.target.x0) {
          left  = d.source;
          right = d.target;
        }

        return 'M' + left.x0 + ',0 ' // start at left edge
          + 'A1,' + ry + ' 0 0,1 '   // radius x/y, axis rotation, large-arc-flag, sweep-flag
          + right.x1 + ',0 '         // target of outer arc
          + 'L' + right.x0 + ',0 '   // line from target right to left
          + 'A1,' + ry + ' 0 0,0 '   // radius x/y, axis rotation, large-arc-flag, sweep-flag
          + left.x1  + ",0 z";       // target of inner arc
      },

      // draw an association between two regions
      association: function (track, d) {
        // prepare data structure for link rendering
        var group = track.append('g').attr('class', 'association'),
            linkObjects = {
              source: {
                x0: priv.scale.x(d.start),
                x1: priv.scale.x(d.end)
              },
              target: {
                x0: priv.scale.x(d.targetStart),
                x1: priv.scale.x(d.targetEnd)
              }
            };

        // draw region rectangle
        group.append('rect')
          .attr('height', settings.trackHeight)
          .attr('width', priv.scale.x(d.end) - priv.scale.x(d.start))
          .attr('x', priv.scale.x(d.start))
          .attr('class', 'region source')
          .attr('title', 'source: ' + d.start + ':' + d.end);

        // draw target rectangle
        group.append('rect')
          .attr('height', settings.trackHeight)
          .attr('width', priv.scale.x(d.targetEnd) - priv.scale.x(d.targetStart))
          .attr('x', priv.scale.x(d.targetStart))
          .attr('class', 'region target')
          .attr('title', 'target: ' + d.targetStart + ':' + d.targetEnd);

        // draw link to target region on same track
        group.append('path')
          .attr('class', 'link')
          .attr('d', priv.draw.link(linkObjects))
          .style({fill: priv.scale.linkColor(d.score/d3.max(self.data.scores))})
          .attr('title', 'score: '+d.score);

        // bring group to the top on hover
        group.on('mouseover', function () {
          var removed = group.classed({'selected': true}).remove();
          track.append(function () { return removed.node(); });
        });
        group.on('mouseleave', function () {
          group.classed({'selected': false});
        });
      }
    };

    priv.render = function (data) {
      // set up chart
          graph = chart.append("g").attr('class', 'data').selectAll("g").data(data),
      var chart = priv.chart,
          computedHeight;

      // update axes and scales
      priv.scale = {
        linkColor: d3.scale.linear()
          .domain(d3.scale.linear().ticks(settings.colors.score.length))
          .range(settings.colors.score),
        x: (function () {
          var extent = d3.extent(self.data.x),
              padded_extent = [ extent[0] - settings.paddingX,
                                extent[1] + settings.paddingX ];

          return d3.scale.linear()
            .domain(padded_extent)
            .range([0, settings.width]);
        })()
      };

      priv.axes = {
        x: d3.svg.axis()
          .scale(priv.scale.x)
          .orient("bottom")
          .tickPadding(settings.paddingTick)
          .ticks(10)
      };

      // process entering data
      graph
        .enter()
        .append("g")
        .attr('class', 'track')
        .each(priv.draw.track);

      // process exiting data
      graph.exit().remove();

      // draw grid and axis
      computedHeight = chart.node().getBBox().height + 2 * settings.paddingY;

      chart.append("g")
        .attr("class", "grid")
        .attr("transform", "translate(0," + computedHeight + ")")
        .call(priv.axes.x
              .tickSize(-computedHeight, 0));

      chart.append("g")
        .attr("class", "x axis")
        .attr("transform", "translate(0," + computedHeight + ")")
        .call(priv.axes.x
              .ticks(40)
              .tickSize(5, 10));

      // draw legend
      chart.call(priv.draw.legend);

      // style chart
      chart
        .attr('class', 'htd3 chart')
        .attr('width', settings.width)
        .attr('height', computedHeight);
    };

    // public functions
    function self (selection) {
      var filename = selection.data()[0];

      // keep selection around for renderer
      priv.chart = selection;

      // initialise settings, load data and render
      return self
        .settings(settings)
        .load(filename, priv.render);
    };

    // chainable getter / setter for settings
    self.settings = function (newSettings) {
      if (!arguments.length) return settings;

      for (var attrname in newSettings) {
        settings[attrname] = newSettings[attrname];
      };

      return self;
    };

    // load tab-separated data from URL, store in self and pass to
    // callback function
    self.load = function (url, callback) {
      // convert some fields to numbers
      function converter (d) {
        return {
          chr:          d.chr,
          start:       +d.start,
          end:         +d.end,
          targetChr:    d.targetChr,
          targetStart: +d.targetStart,
          targetEnd:   +d.targetEnd,
          score:       +d.associationScore
        };
      };

      // group rows by "chr" column
      function groupByTrack (rows) {
        return d3.nest()
          .key(function (d) { return d.chr; })
          .entries(rows);
      };

      // fetch file from URL, convert data and pass grouped data to
      // callback function
      d3.tsv(url, converter, function (d) {
        self.data = {};
        self.data.records = groupByTrack(d);

        // gather x values and scores for scale
        self.data.x = d3.merge(d.map(function (d) { return [+d.start, +d.end, +d.targetStart, +d.targetEnd]; }));
        self.data.scores = d.map(function (d) { return +d.score; });

        // run callback
        callback(self.data.records);
      });

      return self;
    };

    return self;
  })();


  // render the specified graph using the data in the specified
  // filename.  Takes an optional _target element to hold the graph.
  return function htd3 (filename, graph_name, _target) {
    var target = d3.select(_target || 'body').append('svg').data([filename]),
        graph = graphs[graph_name];

    if (graph && typeof(graph) === 'function') {
      return graph(target);
    } else {
      console.log("ERROR: unknown graph '"+graph_name+"'.");
      return undefined;
    }
  };
})();
