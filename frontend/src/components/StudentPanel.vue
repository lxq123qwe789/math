<template>
  <section class="student-page">
    <header class="page-header">
      <h2 class="page-title">点数和试验</h2>
    </header>

    <div class="layout-grid">
      <article class="panel-card control-card">
        <div class="panel-head panel-head-with-action">
          <h3>掷一掷，选一选</h3>
          <button @click="resetAllData" class="reset-btn">重置</button>
        </div>

        <div class="control-overview">
          <div class="overview-top">
            <span class="overview-title">总样本进度</span>
            <span class="overview-value" :class="{ danger: isTotalLocked }">{{ totalCount }}/40</span>
          </div>
          <div class="overview-bar">
            <div class="overview-fill" :style="{ width: `${totalProgress}%` }"></div>
          </div>
          <p class="overview-hint" :class="{ danger: isTotalLocked }">
            {{ isTotalLocked ? '总次数已到 40，当前仅可重置后继续。' : '点击“+”累计总次数，达到40次自动停止新增。' }}
          </p>
        </div>

        <div class="number-grid">
          <div
            v-for="number in [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]"
            :key="number"
            class="number-item"
            :class="{ full: isTotalLocked, 'group-a': isAGroup(number), 'group-b': !isAGroup(number) }"
          >
            <div class="number-top">
              <span class="num-value">{{ number }}</span>
              <span class="num-tag" :class="isAGroup(number) ? 'a-tag' : 'b-tag'">
                {{ isAGroup(number) ? 'A组' : 'B组' }}
              </span>
            </div>

            <div class="action-row">
              <button
                @click="decrementCount(number)"
                :disabled="getData(number)?.count === 0"
                class="minus-btn"
              >
                -
              </button>
              <button
                @click="incrementCount(number)"
                :disabled="isTotalLocked"
                class="plus-btn"
              >
                +
              </button>
            </div>
          </div>
        </div>

        <p v-if="isLoading" class="status-info">正在更新数据...</p>
        <p v-if="error" class="status-error">{{ error }}</p>
      </article>

      <article class="panel-card chart-card">
        <div class="panel-head">
          <h3>点数和统计图</h3>
        </div>
        <div ref="chartContainer" class="chart-container"></div>
      </article>
    </div>

    <div class="stats-row">
      <article class="stat-card a-card">
        <span class="stat-icon ball-icon">●</span>
        <p class="stat-line">掷到A组：{{ statistics.groupA }}次</p>
      </article>

      <article class="stat-card b-card">
        <span class="stat-icon ball-icon">●</span>
        <p class="stat-line">掷到B组：{{ statistics.groupB }}次</p>
      </article>

      <article class="stat-card winner-card" :class="winnerCardClass">
        <span class="stat-icon winner-flag">🚩</span>
        <p class="stat-line">{{ winnerTextForBadge }}</p>
      </article>
    </div>

  </section>
</template>

<script>
import * as echarts from 'echarts'
import axios from 'axios'
import { io } from 'socket.io-client'

export default {
  name: 'StudentPanel',
  props: {
    user: Object
  },
  data() {
    return {
      groupData: [],
      statistics: {
        groupA: 0,
        groupB: 0,
        winner: 'Tie'
      },
      isLoading: false,
      error: '',
      chart: null,
      socket: null,
      isFetchingGroupData: false,
      groupRefreshTimer: null,
      hasPendingGroupRefresh: false,
      groupRefreshDelay: 150
    }
  },
  computed: {
    groupId() {
      if (this.user?.group_id) return this.user.group_id

      const nameToId = {
        '1组': 1,
        '2组': 2,
        '3组': 3,
        '4组': 4,
        '5组': 5,
        '6组': 6,
        '7组': 7,
        '8组': 8,
        '第一组': 1,
        '第二组': 2,
        '第三组': 3,
        '第四组': 4,
        '第五组': 5,
        '第六组': 6,
        '第七组': 7,
        '第八组': 8,
        '202601': 1,
        '202602': 2,
        '202603': 3,
        '202604': 4,
        '202605': 5,
        '202606': 6,
        '202607': 7,
        '202608': 8,
      }

      return nameToId[this.user?.username] || 1
    },
    totalCount() {
      return this.groupData.reduce((sum, item) => sum + (item.count || 0), 0)
    },
    isTotalLocked() {
      return this.totalCount >= 40
    },
    totalProgress() {
      return Math.min(100, (this.totalCount / 40) * 100)
    },
    winnerBadgeClass() {
      if (this.statistics.winner === 'A') return 'a-badge'
      if (this.statistics.winner === 'B') return 'b-badge'
      return 'tie-badge'
    },
    winnerCardClass() {
      if (this.statistics.winner === 'A') return 'winner-a-card'
      if (this.statistics.winner === 'B') return 'winner-b-card'
      return 'winner-tie-card'
    },
    winnerTextForBadge() {
      if (this.statistics.winner === 'A') return 'A组获胜'
      if (this.statistics.winner === 'B') return 'B组获胜'
      return '当前平局'
    },
    winnerSummaryText() {
      if (this.statistics.winner === 'A') return 'A组获胜'
      if (this.statistics.winner === 'B') return 'B组获胜'
      return '两组暂时打平'
    }
  },
  methods: {
    async fetchGroupData() {
      if (this.isFetchingGroupData) {
        this.hasPendingGroupRefresh = true
        return
      }

      this.isFetchingGroupData = true
      try {
        this.error = ''
        const response = await axios.get(`/api/student/group/${this.groupId}/data`)

        this.groupData = response.data.records
        this.statistics = {
          groupA: response.data.group_a_total,
          groupB: response.data.group_b_total,
          winner: response.data.winner
        }

        this.updateChart()
      } catch (err) {
        this.error = '获取数据失败：' + (err.response?.data?.detail || err.message)
      } finally {
        this.isFetchingGroupData = false
        if (this.hasPendingGroupRefresh) {
          this.hasPendingGroupRefresh = false
          this.scheduleFetchGroupData()
        }
      }
    },
    scheduleFetchGroupData() {
      this.hasPendingGroupRefresh = true
      if (this.groupRefreshTimer) return

      this.groupRefreshTimer = setTimeout(async () => {
        this.groupRefreshTimer = null
        if (!this.hasPendingGroupRefresh) return
        this.hasPendingGroupRefresh = false
        await this.fetchGroupData()
      }, this.groupRefreshDelay)
    },
    connectSocket() {
      if (this.socket) return

      this.socket = io('/', {
        path: '/socket.io',
        transports: ['websocket', 'polling'],
        reconnection: true
      })

      this.socket.on('connect', () => {
        this.error = ''
      })

      this.socket.on('connect_error', (err) => {
        this.error = '实时连接失败：' + err.message
      })

      this.socket.on('data_updated', (payload) => {
        const groupIds = Array.isArray(payload?.group_ids)
          ? payload.group_ids.map(id => Number(id)).filter(id => Number.isInteger(id))
          : []
        if (!groupIds.length || groupIds.includes(this.groupId)) {
          this.scheduleFetchGroupData()
        }
      })
    },

    getData(number) {
      return this.groupData.find(r => r.number === number)
    },

    isAGroup(number) {
      return [2, 3, 4, 10, 11, 12].includes(number)
    },

    async incrementCount(number) {
      if (this.isTotalLocked) {
        this.error = '总次数已达到40次，不能继续增加'
        return
      }

      this.isLoading = true
      try {
        await axios.post(
          '/api/student/update',
          {
            group_id: this.groupId,
            number,
            action: 'increment'
          },
          {
            params: { group_id: this.groupId, number, action: 'increment' }
          }
        )

        await this.fetchGroupData()
      } catch (err) {
        this.error = err.response?.data?.detail || '更新失败'
      } finally {
        this.isLoading = false
      }
    },

    async decrementCount(number) {
      const count = this.getData(number)?.count || 0
      if (count === 0) {
        this.error = '次数不能为负数'
        return
      }

      this.isLoading = true
      try {
        await axios.post(
          '/api/student/update',
          {
            group_id: this.groupId,
            number,
            action: 'decrement'
          },
          {
            params: { group_id: this.groupId, number, action: 'decrement' }
          }
        )

        await this.fetchGroupData()
      } catch (err) {
        this.error = err.response?.data?.detail || '更新失败'
      } finally {
        this.isLoading = false
      }
    },

    async resetAllData() {
      if (!confirm('确定要重置所有数据吗？')) return

      this.isLoading = true
      try {
        await axios.post(`/api/student/group/${this.groupId}/reset`)
        await this.fetchGroupData()
      } catch (err) {
        this.error = '重置失败：' + (err.response?.data?.detail || err.message)
      } finally {
        this.isLoading = false
      }
    },

    updateChart() {
      if (!this.chart) return

      const numbers = this.groupData.map(r => r.number)
      const counts = this.groupData.map(r => r.count)
      const maxCount = counts.length ? Math.max(...counts) : 0
      const axisMax = Math.max(10, maxCount)

      const option = {
        animationDuration: 300,
        tooltip: {
          trigger: 'axis',
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
          nameTextStyle: { color: '#334155', fontSize: 13, fontWeight: 600, align: 'right', padding: [0, -12, 0, 0] },
          boundaryGap: true,
          axisTick: { show: false },
          axisLine: { lineStyle: { color: '#64748b', width: 1 } },
          axisLabel: {
            color: '#334155',
            interval: 0,
            hideOverlap: false,
            lineHeight: 18,
            formatter(value) {
              return Number(value) === 12 ? '12\n{axisName|点数和}' : `${value}`
            },
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
            data: numbers.map((n, idx) => ({
              value: counts[idx],
              itemStyle: {
                color: [2, 3, 4, 10, 11, 12].includes(n) ? '#FFE600' : '#D92121'
              }
            })),
            itemStyle: {
              borderWidth: 0,
            },
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

      this.chart.setOption(option)
    },

    initChart() {
      const container = this.$refs.chartContainer
      if (!container) return

      this.chart = echarts.init(container)
      this.chart.setOption({
        xAxis: {
          type: 'category',
          z: 5,
          data: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
          name: '',
          nameLocation: 'end',
          nameGap: 18,
          nameTextStyle: { color: '#334155', fontSize: 13, fontWeight: 600, align: 'right', padding: [0, -12, 0, 0] },
          axisLine: { lineStyle: { color: '#64748b', width: 1 } },
          axisLabel: {
            color: '#334155',
            interval: 0,
            hideOverlap: false,
            lineHeight: 18,
            formatter(value) {
              return Number(value) === 12 ? '12\n{axisName|点数和}' : `${value}`
            },
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
          max: 10,
          name: '次数',
          nameLocation: 'end',
          nameGap: 14,
          nameTextStyle: { color: '#334155', fontSize: 13, fontWeight: 600 },
          interval: 1,
          splitLine: { show: true, lineStyle: { color: '#cbd5e1', width: 1 } },
          axisLine: { show: true, lineStyle: { color: '#94a3b8', width: 1 } },
          axisTick: { show: false },
          axisLabel: { color: '#334155' }
        },
        grid: {
          show: true,
          borderColor: '#cbd5e1',
          borderWidth: 1,
          left: 27,
          right: 20,
          top: 28,
          bottom: 44,
          containLabel: true
        },
        series: [{
          type: 'bar',
          z: 1,
          barWidth: '100%',
          barCategoryGap: '0%',
          barGap: '0%',
          data: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
          label: {
            show: true,
            position: 'top',
            distance: -2,
            color: '#1e293b',
            fontSize: 18
          }
        }]
      })

      window.addEventListener('resize', () => {
        this.chart?.resize()
      })
    }
  },
  mounted() {
    this.initChart()
    this.fetchGroupData()
    this.connectSocket()
  },
  beforeUnmount() {
    if (this.groupRefreshTimer) clearTimeout(this.groupRefreshTimer)
    if (this.socket) this.socket.disconnect()
    if (this.chart) this.chart.dispose()
  }
}
</script>

<style scoped>
.student-page {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.page-header {
  margin-top: 8px;
  text-align: center;
}

.page-title {
  margin: 0;
  font-size: 30px;
  line-height: 1.2;
  color: #0f172a;
}

.page-subtitle {
  margin: 8px 0 0;
  color: #64748b;
  font-size: 14px;
}

.layout-grid {
  display: grid;
  grid-template-columns: 1.08fr 1.3fr;
  gap: 16px;
  align-items: start;
}

.panel-card {
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 16px;
  box-shadow: 0 8px 22px rgba(15, 23, 42, 0.06);
  padding: 16px;
}

.panel-head {
  display: flex;
  justify-content: center;
  align-items: center;
  margin-bottom: 14px;
}

.control-card .panel-head {
  margin-bottom: 10px;
}

.chart-card .panel-head {
  margin-bottom: 40px;
}

.panel-head-with-action {
  position: relative;
  justify-content: flex-end;
}

.panel-head h3 {
  margin: 0;
  font-size: 18px;
  color: #0f172a;
  text-align: center;
}

.panel-head-with-action h3 {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
}

.reset-btn {
  border: none;
  border-radius: 10px;
  background: #0f172a;
  color: #fff;
  padding: 8px 12px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}

.control-overview {
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 10px 12px;
  background: #f8fafc;
  margin-bottom: 12px;
}

.overview-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.overview-title {
  font-size: 12px;
  font-weight: 700;
  color: #334155;
}

.overview-value {
  font-size: 14px;
  font-weight: 800;
  color: #0f172a;
}

.overview-value.danger {
  color: #b91c1c;
}

.overview-bar {
  height: 8px;
  border-radius: 999px;
  background: #e2e8f0;
  overflow: hidden;
}

.overview-fill {
  height: 100%;
  border-radius: 999px;
  background: #3b82f6;
  transition: width 0.2s ease;
}

.overview-hint {
  margin: 8px 0 0;
  font-size: 12px;
  color: #64748b;
}

.overview-hint.danger {
  color: #b91c1c;
  font-weight: 600;
}

.number-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
}

.control-card .number-grid {
  column-gap: 10px;
  row-gap: 21px;
}

.number-item {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 14px;
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.control-card .number-item {
  padding: 8px;
  gap: 8px;
  min-height: 86px;
}

.number-item.full {
  background: #f1f5f9;
  border-color: #cbd5e1;
}

.number-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.num-value {
  font-size: 26px;
  line-height: 1;
  font-weight: 800;
  color: #0f172a;
}

.control-card .num-value {
  font-size: 30px;
}

.number-item.group-a .num-value {
  color: #FFE600;
}

.number-item.group-b .num-value {
  color: #D92121;
}

.num-tag {
  font-size: 11px;
  font-weight: 700;
  border-radius: 999px;
  padding: 3px 8px;
}

.a-tag {
  background: #FFE600;
  color: #1f2937;
}

.b-tag {
  background: #D92121;
  color: #ffffff;
}

.full-flag {
  color: #ef4444;
}

.action-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.minus-btn,
.plus-btn {
  border: none;
  border-radius: 10px;
  padding: 8px 0;
  font-size: 22px;
  line-height: 1;
  font-weight: 700;
  cursor: pointer;
}

.control-card .minus-btn,
.control-card .plus-btn {
  padding: 3px 0;
  font-size: 18px;
}

.minus-btn {
  background: #dcfce7;
  color: #15803d;
}

.plus-btn {
  background: #fee2e2;
  color: #b91c1c;
}

.minus-btn:disabled {
  background: #dcfce7;
  color: #15803d;
  opacity: 0.45;
  cursor: not-allowed;
}

.plus-btn:disabled {
  background: #fee2e2;
  color: #b91c1c;
  opacity: 0.45;
  cursor: not-allowed;
}

.chart-container {
  height: 380px;
}

.status-info {
  margin: 12px 0 0;
  color: #3b82f6;
  font-size: 13px;
  font-weight: 600;
}

.status-error {
  margin: 10px 0 0;
  color: #b91c1c;
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 10px;
  padding: 8px 10px;
  font-size: 13px;
}

.stats-row {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.stat-card {
  border-radius: 14px;
  padding: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  border: 1px solid #e2e8f0;
  white-space: nowrap;
}

.stat-icon {
  font-size: 22px;
}

.stat-line {
  margin: 0;
  font-size: 22px;
  line-height: 1.1;
  font-weight: 800;
}

.stats-row .stat-card:nth-child(3) .stat-line {
  font-size: 50px;
}

.winner-flag {
  font-size: 33px;
}

.ball-icon {
  color: #334155;
}

.stat-label {
  margin: 0;
  font-size: 12px;
  color: #64748b;
  font-weight: 600;
}

.large-label {
  font-size: 22px;
  line-height: 1.1;
  font-weight: 800;
}

.stat-value {
  margin: 4px 0 0;
  font-size: 22px;
  line-height: 1.1;
  font-weight: 800;
}

.a-card {
  background: #fef9c3;
}

.a-card .stat-label,
.a-card .stat-value,
.a-card .stat-icon {
  color: #a16207;
}

.b-card {
  background: #fee2e2;
}

.b-card .stat-label,
.b-card .stat-value,
.b-card .stat-icon {
  color: #b91c1c;
}

.winner-card {
  background: #ffffff;
}

.winner-a-card {
  background: #ffffff;
}

.winner-a-card .stat-label,
.winner-a-card .stat-icon {
  color: #64748b;
}

.winner-a-card .stat-line {
  color: #FFE600;
}

.winner-b-card {
  background: #ffffff;
}

.winner-b-card .stat-label,
.winner-b-card .stat-icon {
  color: #64748b;
}

.winner-b-card .stat-line {
  color: #D92121;
}

.winner-tie-card {
  background: #ffffff;
}

.winner-badge {
  margin-top: 6px;
  display: inline-block;
  border-radius: 999px;
  padding: 6px 10px;
  font-size: 12px;
  font-weight: 700;
  text-align: center;
  background: rgba(255, 255, 255, 0.35);
}

.a-badge {
  background: #fef9c3;
  color: #a16207;
}

.b-badge {
  background: #fee2e2;
  color: #b91c1c;
}

.tie-badge {
  background: #e2e8f0;
  color: #334155;
}

.summary-text {
  margin: 2px 0 0;
  color: #334155;
  font-size: 15px;
  line-height: 1.75;
  text-align: center;
}

@media (max-width: 1100px) {
  .layout-grid {
    grid-template-columns: 1fr 1fr;
    align-items: stretch;
  }

  .layout-grid .panel-card {
    height: 100%;
  }

  .chart-container {
    height: 340px;
  }
}

@media (max-width: 760px) {
  .layout-grid {
    grid-template-columns: 1fr;
  }

  .page-title {
    font-size: 24px;
  }

  .number-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .stats-row {
    grid-template-columns: 1fr;
  }
}
</style>
