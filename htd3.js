'use strict';

var htd3 = (function () {
  // any graph is a function that takes a d3 selection and returns a
  // function initialised with said selection.
  var graphs = {};


  // visualisation of associations between regions
  graphs.associations = function (selection) {
    var priv = {},
        chart = selection,
        settings = {
          animation: {
            groupDelay: 300,
            trackDelay: 200
          },
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
    priv.render = (function () {
      var trackOffset = 0;

      function drawLegend (selection, min, max) {
        var legend = selection.append('g').attr('class', 'legend'),
            gradientId,
            gradient = legend.append('defs').append('linearGradient'),
            node,
            offset = 0,
            legendPadding = 4;

        // build gradient stops from colors
        for (var i=0; i <= settings.colors.score.length; i++) {
          var percent = i/settings.colors.score.length;
          gradient.append('stop')
            .attr('offset', (100*percent) + '%')
            .attr('stop-color', priv.scale.linkColor(percent) );
        };

        // give the gradient a unique id
        gradientId = 'linearGradient_' + settings.colors.score.join('_');
        gradient.attr('id', gradientId),

        // place minimum value text to the left...
        node = legend.append('text')
          .text(min)
          .attr('dominant-baseline', 'middle')
          .attr('x', legendPadding)
          .attr('y', settings.legendHeight / 2);
        offset += node.node().getBBox().width + legendPadding * 2;

        // ...the gradient box in the middle...
        node = legend.append('rect')
          .attr('fill', 'url(#'+gradientId+')')
          .attr('height', settings.legendHeight)
          .attr('width', 100)
          .attr('x', offset);
        offset += node.node().getBBox().width + legendPadding;

        // ...and the maximum value text on the right.
        legend.append('text')
          .text(max)
          .attr('dominant-baseline', 'middle')
          .attr('x', offset)
          .attr('y', settings.legendHeight / 2);
      }

      // draw track with all associations
      function drawTrack (d, i) {
        var context = d3.select(this),
            computedHeight,
            y,
            min = d3.min(self.data.scores),
            max = d3.max(self.data.scores);

        function normaliseScore (score) {
          return (score - min) / (max - min);
        };

        // draw an association between two regions
        function drawAssociation (d, i) {
          // prepare data structure for link rendering
          var group = d3.select(this),
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
            .attr('class', 'region source')
            .attr('height', settings.trackHeight)
            .attr('width', priv.scale.x(d.end) - priv.scale.x(d.start))
            .attr('x', priv.scale.x(d.start))
            .attr('title', 'source: ' + d.start + ':' + d.end);

          // draw target rectangle
          group.append('rect')
            .attr('class', 'region target')
            .attr('height', settings.trackHeight)
            .attr('width', priv.scale.x(d.targetEnd) - priv.scale.x(d.targetStart))
            .attr('x', priv.scale.x(d.targetStart))
            .attr('title', 'target: ' + d.targetStart + ':' + d.targetEnd);

          // draw link to target region on same track
          group.append('path')
            .attr('class', 'link')
            .attr('d', linkPath(linkObjects))
            .style({fill: priv.scale.linkColor(normaliseScore(d.score))})
            .attr('title', 'score: '+d.score);

          // bring group to the top on hover
          group.on('mouseover', function () {
            var parent = d3.select(this.parentNode),
                removed = group.classed({'selected': true}).remove();
            parent.append(function () { return removed.node(); });
          });
          group.on('mouseleave', function () {
            group.classed({'selected': false});
          });
        }

        // draw track
        context.append('rect')
          .attr('class', 'base')
          .attr('height', settings.trackHeight)
          .attr('width', '100%')
          .attr('title', d.key);

        // append track name
        context.append('text')
          .text(d.key)
          .attr('font-size', settings.trackHeight * 0.8)
          .attr('dominant-baseline', 'middle')
          .attr('x', 3)
          .attr('y', settings.trackHeight / 2);

        // draw regions with associations for this track
        var associations = context
              .selectAll('g.association')
              .data(d.values);

        associations.enter()
          .append('g')
          .attr('class', 'association')
          .each(drawAssociation);

        // fade in
        associations
          .attr('opacity', 0)
          .transition()
          .delay(function (d, assoc_id) {
            var del = (assoc_id + 1) * settings.animation.groupDelay + i * settings.animation.trackDelay;
            return del;
          })
          .duration(500)
          .attr('opacity', 1);


        // adjust vertical position based on computed track height
        computedHeight = context.node().getBBox().y;
        y = -computedHeight + trackOffset + settings.paddingY;
        context.attr('transform', 'translate(0,'+ y +')');
        trackOffset = y;
      }

      // generate link path
      function linkPath (d) {
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
      }

      // return actual render function
      return function (selection) {
        var computedHeight,
            boundData;

        // abort if no data is bound!
        if (self.data === undefined) {
          return self;
        }

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

        // draw tracks for bound data
        selection
          .attr('class', 'track')
          .each(drawTrack);

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
        var min = d3.min(self.data.scores),
            max = d3.max(self.data.scores);
        chart.call(drawLegend, min, max);

        // recompute height to include axes
        computedHeight = chart.node().getBBox().height;

        // style chart
        chart
          .attr('class', 'htd3 chart')
          .attr('width', settings.width)
          .attr('height', computedHeight);

        return self;
      };
    })();

    priv.store = function (data) {
      // group rows by "chr" column
      function groupByTrack (rows) {
        return d3.nest()
          .key(function (d) { return d.chr; })
          .entries(rows);
      };

      self.data = {};
      self.data.records = groupByTrack(data);

      // gather x values and scores for scale
      self.data.x = d3.merge(data.map(function (d) { return [+d.start, +d.end, +d.targetStart, +d.targetEnd]; }));
      self.data.scores = data.map(function (d) { return +d.score; });

      return data;
    };

    // convert some fields to numbers
    priv.converter = function (d) {
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

    // public functions
    function self (selection) {
      // initialise settings
      self.settings(settings);

      // render data
      chart.selectAll('g').call(priv.render);

      return self;
    };

    // chainable getter / setter for settings
    self.settings = function (newSettings) {
      if (!arguments.length) return settings;

      for (var attrname in newSettings) {
        settings[attrname] = newSettings[attrname];
      };

      return self;
    };

    // create a data group containing one group for each data item; then render
    self.bind_data = function (data) {
      priv.store(data);
      var tracks = chart
        .selectAll('g')
        .data(self.data.records);

      tracks.enter().append('g')
        .call(priv.render);
      return self;
    };


    // load tab-separated data from URL or JSON array
    self.load = function (url_or_data) {
      if (typeof(url_or_data) === 'object') {
        return self.bind_data(url_or_data);
      } else {
        // fetch file from URL, convert data and bind grouped data
        d3.tsv(url_or_data, priv.converter, self.bind_data);
      }

      return self;
    };

    return self(selection);
  };


  // render the specified graph using the data in the specified
  // filename.  Takes an optional _target element to hold the graph.
  function htd3 (graph_name, url_or_data, _target) {
    var graph = graphs[graph_name],
        data,
        target;

    if (graph && typeof(graph) === 'function') {
      target = d3.select(_target || 'body').append('svg');
      return graph(target).load(url_or_data);
    } else {
      console.log("ERROR: unknown graph '"+graph_name+"'.");
      return undefined;
    }
  };

  // expose graphs
  htd3.graphs = graphs;
  return htd3;
})();
