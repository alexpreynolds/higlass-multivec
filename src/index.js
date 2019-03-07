import register from 'higlass-register';

import StackedBarTrack from './scripts/StackedBarTrack';
import StackedCategoricalBarTrack from './scripts/StackedCategoricalBarTrack';
import ScaledStackedBarTrack from './scripts/ScaledStackedBarTrack';
import BasicMultipleLineChart from './scripts/BasicMultipleLineChart';
import BasicMultipleBarChart from './scripts/BasicMultipleBarChart';

register({
  name: 'StackedBarTrack',
  track: StackedBarTrack,
  config: StackedBarTrack.config,
});

register({
  name: 'StackedCategoricalBarTrack',
  track: StackedCategoricalBarTrack,
  config: StackedCategoricalBarTrack.config,
});

register({
  name: 'ScaledStackedBarTrack',
  track: ScaledStackedBarTrack,
  config: ScaledStackedBarTrack.config,
});

register({
  name: 'BasicMultipleLineChart',
  track: BasicMultipleLineChart,
  config: BasicMultipleLineChart.config,
});

register({
  name: 'BasicMultipleBarChart',
  track: BasicMultipleBarChart,
  config: BasicMultipleBarChart.config,
});
