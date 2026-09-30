export const GROUP_A_NUMBERS = [2, 3, 4, 10, 11, 12]
export const GROUP_B_NUMBERS = [5, 6, 7, 8, 9]

export const STUDENT_GROUP_A_NUMBERS = GROUP_A_NUMBERS
export const STUDENT_CHART_NUMBERS = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]

function teacherAxisLabelFormatter(value) {
  return `${value}`
}

function studentAxisLabelFormatter(value) {
  return Number(value) === 12 ? '12\n{axisName|点数和}' : `${value}`
}

export function isGroupANumber(value) {
  return GROUP_A_NUMBERS.includes(Number(value))
}

export function buildMiniChartOption({ numbers, counts, axisMax }) {
  return {
    animation: false,
    grid: {
      show: true,
      borderColor: '#cbd5e1',
      borderWidth: 1,
      left: 24,
      right: 26,
      top: 22,
      bottom: 12,
      containLabel: true
    },
    xAxis: {
      type: 'category',
      z: 5,
      data: numbers,
      boundaryGap: true,
      name: '点数和',
      nameLocation: 'end',
      nameGap: 2,
      nameTextStyle: { color: '#334155', fontSize: 8, fontWeight: 600 },
      axisLabel: {
        show: true,
        fontSize: 9,
        fontWeight: 700,
        color: '#334155',
        interval: 0,
        hideOverlap: false,
        lineHeight: 12,
        formatter: teacherAxisLabelFormatter
      },
      axisTick: { show: false },
      axisLine: { show: true, lineStyle: { color: '#64748b', width: 1 } },
      splitLine: { show: true, lineStyle: { color: '#cbd5e1', width: 2 } }
    },
    yAxis: {
      type: 'value',
      z: 5,
      min: 0,
      max: axisMax,
      name: '次数',
      nameLocation: 'end',
      nameGap: 8,
      nameTextStyle: { color: '#334155', fontSize: 8, fontWeight: 600 },
      interval: 1,
      splitLine: { show: true, lineStyle: { color: '#cbd5e1', width: 2 } },
      axisLabel: { show: true, fontSize: 9, color: '#334155' },
      axisTick: { show: false },
      axisLine: { show: true, lineStyle: { color: '#94a3b8', width: 1 } }
    },
    series: [
      {
        type: 'bar',
        z: 1,
        barWidth: '100%',
        data: numbers.map((n, idx) => ({
          value: counts[idx],
          itemStyle: {
            color: isGroupANumber(n) ? '#FFE600' : '#D92121'
          }
        })),
        itemStyle: { borderWidth: 0 },
        label: {
          show: true,
          position: 'top',
          distance: -2,
          fontSize: 14,
          color: '#334155'
        }
      }
    ]
  }
}

export function buildClassChartOption({ numbers, counts, alignedAxisMax, axisInterval }) {
  return {
    tooltip: { trigger: 'axis' },
    grid: {
      show: true,
      borderColor: '#cbd5e1',
      borderWidth: 1,
      left: 24,
      right: 50,
      top: 30,
      bottom: 24,
      containLabel: true
    },
    xAxis: {
      type: 'category',
      z: 5,
      data: numbers,
      boundaryGap: true,
      name: '点数和',
      nameLocation: 'end',
      nameGap: 8,
      nameTextStyle: { color: '#334155', fontSize: 12, fontWeight: 600 },
      axisTick: { show: false },
      axisLine: { lineStyle: { color: '#64748b', width: 1 } },
      axisLabel: {
        fontSize: 12,
        fontWeight: 700,
        color: '#334155',
        interval: 0,
        hideOverlap: false,
        lineHeight: 20,
        margin: 14,
        formatter: teacherAxisLabelFormatter
      },
      splitLine: { show: true, lineStyle: { color: '#cbd5e1', width: 2 } }
    },
    yAxis: {
      type: 'value',
      z: 5,
      min: 0,
      max: alignedAxisMax,
      name: '次数',
      nameLocation: 'end',
      nameGap: 10,
      nameTextStyle: { color: '#334155', fontSize: 12, fontWeight: 600 },
      interval: axisInterval,
      splitLine: { show: true, lineStyle: { color: '#cbd5e1', width: 1 } },
      axisLabel: { color: '#334155' },
      axisLine: { show: true, lineStyle: { color: '#94a3b8', width: 1 } },
      axisTick: { show: false }
    },
    series: [
      {
        type: 'bar',
        z: 1,
        barWidth: '100%',
        data: numbers.map((n, idx) => ({
          value: counts[idx],
          itemStyle: {
            color: isGroupANumber(n) ? '#FFE600' : '#D92121'
          }
        })),
        itemStyle: { borderWidth: 0 },
        label: { show: true, position: 'top', distance: -2, fontSize: 18, color: '#334155' }
      }
    ]
  }
}

export function buildSimulationChartOption({
  numbers,
  counts,
  axisMax,
  axisInterval,
  simLabelFontSize
}) {
  return {
    tooltip: { trigger: 'axis' },
    animation: true,
    animationDuration: 0,
    animationDurationUpdate: 50,
    animationEasingUpdate: 'linear',
    grid: {
      show: true,
      borderColor: '#cbd5e1',
      borderWidth: 1,
      left: 20,
      right: 54,
      top: 30,
      bottom: 24,
      containLabel: true
    },
    xAxis: {
      type: 'category',
      z: 5,
      data: numbers,
      boundaryGap: true,
      name: '点数和',
      nameLocation: 'end',
      nameGap: 8,
      nameTextStyle: { color: '#334155', fontSize: 12, fontWeight: 600 },
      axisTick: { show: false },
      axisLine: { lineStyle: { color: '#64748b', width: 2 } },
      axisLabel: {
        fontSize: 12,
        fontWeight: 700,
        color: '#334155',
        interval: 0,
        hideOverlap: false,
        lineHeight: 20,
        margin: 14,
        formatter: teacherAxisLabelFormatter
      },
      splitLine: { show: true, lineStyle: { color: '#cbd5e1', width: 2 } }
    },
    yAxis: {
      type: 'value',
      z: 5,
      min: 0,
      max: axisMax,
      name: '次数',
      nameLocation: 'end',
      nameGap: 10,
      nameTextStyle: { color: '#334155', fontSize: 12, fontWeight: 600 },
      interval: axisInterval,
      splitLine: { show: true, lineStyle: { color: '#cbd5e1', width: 1 } },
      axisLabel: { color: '#334155' },
      axisLine: { show: true, lineStyle: { color: '#94a3b8', width: 2 } },
      axisTick: { show: false }
    },
    series: [
      {
        type: 'bar',
        z: 1,
        barWidth: '100%',
        animation: true,
        animationDurationUpdate: 50,
        animationEasingUpdate: 'linear',
        data: numbers.map((n, idx) => ({
          value: counts[idx],
          itemStyle: {
            color: isGroupANumber(n) ? '#FFE600' : '#D92121'
          }
        })),
        itemStyle: { borderWidth: 0, borderRadius: [4, 4, 0, 0] },
        label: {
          show: true,
          position: 'top',
          distance: -2,
          fontSize: simLabelFontSize,
          color: '#334155',
          overflow: 'truncate',
          width: 70,
          formatter: ({ value }) => Math.round(Number(value || 0))
        }
      }
    ]
  }
}

function getStudentBarData(numbers, counts) {
  return numbers.map((n, idx) => ({
    value: counts[idx],
    itemStyle: {
      color: STUDENT_GROUP_A_NUMBERS.includes(n) ? '#FFE600' : '#D92121'
    }
  }))
}

export function buildStudentChartOption({ numbers, counts, axisMax }) {
  return {
    animationDuration: 300,
    tooltip: {
      trigger: 'axis',
      confine: true,
      formatter(params) {
        if (!params.length) return ''
        const item = params[0]
        return `点数 ${item.name}：${item.value} 次`
      }
    },
    xAxis: {
      type: 'category',
      z: 5,
      data: numbers,
      name: '',
      nameLocation: 'end',
      nameGap: 18,
      nameTextStyle: {
        color: '#334155',
        fontSize: 13,
        fontWeight: 600,
        align: 'right',
        padding: [0, -12, 0, 0]
      },
      boundaryGap: true,
      axisTick: { show: false },
      axisLine: { lineStyle: { color: '#64748b', width: 1 } },
      axisLabel: {
        color: '#334155',
        interval: 0,
        hideOverlap: false,
        lineHeight: 18,
        formatter: studentAxisLabelFormatter,
        rich: {
          axisName: {
            fontWeight: 700,
            color: '#334155'
          }
        }
      },
      splitLine: { show: true, lineStyle: { color: '#cbd5e1', width: 1 } }
    },
    yAxis: {
      type: 'value',
      z: 5,
      min: 0,
      max: axisMax,
      name: '次数',
      nameLocation: 'end',
      nameGap: 14,
      nameTextStyle: { color: '#334155', fontSize: 13, fontWeight: 600 },
      interval: 1,
      splitLine: { show: true, lineStyle: { color: '#cbd5e1', width: 1 } },
      axisLabel: { color: '#334155' },
      axisLine: { show: true, lineStyle: { color: '#94a3b8', width: 1 } },
      axisTick: { show: false }
    },
    series: [
      {
        type: 'bar',
        z: 1,
        barWidth: '100%',
        barCategoryGap: '0%',
        barGap: '0%',
        data: getStudentBarData(numbers, counts),
        itemStyle: { borderWidth: 0 },
        label: {
          show: true,
          position: 'top',
          distance: -2,
          color: '#1e293b',
          fontSize: 18
        }
      }
    ],
    grid: {
      show: true,
      borderColor: '#cbd5e1',
      borderWidth: 1,
      left: 27,
      right: 20,
      top: 28,
      bottom: 44,
      containLabel: true
    }
  }
}

export function buildStudentInitialChartOption() {
  return buildStudentChartOption({
    numbers: STUDENT_CHART_NUMBERS,
    counts: Array(11).fill(0),
    axisMax: 8
  })
}
