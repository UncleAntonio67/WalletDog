// pages/detail/detail.js
import * as echarts from '../../ec-canvas/echarts';

let chart = null;

Page({
  data: {
    asset: {},
    
    // 基金/理财数据
    fixedProfit: 0,
    totalRate: 0,
    costPrice: 0,
    
    // 存款专用数据
    depositInfo: {
      endDate: '--',      // 到期日
      interest: '0.00',   // 预估利息
      total: '0.00',      // 本息合计
      daysLeft: 0,        // 剩余天数
      progress: 0         // 进度条 (0-100)
    },

    // 图表数据
    ec: { lazyLoad: true },
    currentRange: '1m', 
    allHistory: []
  },

  onLoad(options) {
    if (options.assetStr) {
      const asset = JSON.parse(decodeURIComponent(options.assetStr));

      // --- 通用处理 ---
      const profit = parseFloat(asset.balance) - parseFloat(asset.principal);
      let rate = 0;
      if (asset.principal > 0) {
        rate = (profit / asset.principal) * 100;
      }

      let cost = 0;
      if (asset.type !== '银行存款' && asset.shares > 0) {
        cost = asset.principal / asset.shares;
      }

      // --- 存款专属智能计算 ---
      let depositInfo = {};
      if (asset.type === '银行存款') {
        depositInfo = this.calcDeposit(asset);
      }

      this.setData({
        asset: asset,
        fixedProfit: profit.toFixed(2),
        totalRate: rate.toFixed(2),
        costPrice: cost.toFixed(4),
        depositInfo: depositInfo // 存入计算结果
      }, () => {
        // 只有非存款类才有图表
        if (asset.type !== '银行存款' && asset.code) {
          setTimeout(() => {
            this.getHistoryData(asset.code);
          }, 300);
        }
      });
      
      wx.setNavigationBarTitle({ title: asset.name });
    }
  },

  // ✨✨✨ 存款智能计算器 ✨✨✨
  calcDeposit(asset) {
    // 默认值
    let result = { endDate: '未定', interest: '0.00', total: asset.principal, daysLeft: 0, progress: 0 };
    
    // 必须有买入日期、期限、利率才能算
    if (!asset.buyDate || !asset.depositTerm || !asset.annualRate) return result;

    try {
      const startDate = new Date(asset.buyDate.replace(/-/g, '/'));
      const termStr = asset.depositTerm; 
      const principal = parseFloat(asset.principal);
      const rate = parseFloat(asset.annualRate) / 100; // 2.85 -> 0.0285

      let durationDays = 0; // 总存期天数
      let endDate = new Date(startDate);

      // 1. 解析存期 (支持 "3年", "6个月", "90天")
      if (termStr.includes('年')) {
        const y = parseFloat(termStr) || 0;
        durationDays = y * 365;
        endDate.setFullYear(startDate.getFullYear() + y);
      } else if (termStr.includes('个月') || termStr.includes('月')) {
        const m = parseFloat(termStr) || 0;
        durationDays = m * 30;
        endDate.setMonth(startDate.getMonth() + m);
      } else if (termStr.includes('天') || termStr.includes('日')) {
        const d = parseFloat(termStr) || 0;
        durationDays = d;
        endDate.setDate(startDate.getDate() + d);
      } else {
        // 纯数字默认按年算
        const y = parseFloat(termStr) || 0;
        durationDays = y * 365;
        endDate.setFullYear(startDate.getFullYear() + y);
      }

      // 2. 计算利息 (本金 * 利率 * 年份)
      // 简单按天数折算年化
      const interest = principal * rate * (durationDays / 365);
      const total = principal + interest;

      // 3. 计算时间进度
      const today = new Date();
      const totalTime = endDate.getTime() - startDate.getTime();
      const passTime = today.getTime() - startDate.getTime();
      let progress = 0;
      
      if (totalTime > 0) {
        progress = (passTime / totalTime) * 100;
        if (progress > 100) progress = 100;
        if (progress < 0) progress = 0;
      }

      // 剩余天数
      const leftTime = endDate.getTime() - today.getTime();
      const daysLeft = Math.ceil(leftTime / (1000 * 60 * 60 * 24));

      // 格式化输出
      result.endDate = `${endDate.getFullYear()}-${endDate.getMonth()+1}-${endDate.getDate()}`;
      result.interest = interest.toFixed(2);
      result.total = total.toFixed(2);
      result.daysLeft = daysLeft > 0 ? daysLeft : 0;
      result.progress = progress.toFixed(1);

    } catch (e) {
      console.error('存款计算出错', e);
    }
    return result;
  },

  // 跳转记账
  goAddPosition() {
    const asset = this.data.asset;
    const app = getApp();
    app.globalData.tempAsset = {
      name: asset.name,
      code: asset.code,
      type: asset.type
    };
    wx.switchTab({ url: '/pages/add/add' });
  },

  // --- 以下是图表逻辑 (保持不变) ---
  getHistoryData(code) {
    const ecComponent = this.selectComponent('#mychart-dom-line');
    if (!ecComponent) return;

    ecComponent.init((canvas, width, height, dpr) => {
      chart = echarts.init(canvas, null, { width, height, devicePixelRatio: dpr });
      chart.showLoading();
      wx.cloud.callFunction({
        name: 'getFundData',
        data: { type: 'history', codes: [code] }
      }).then(res => {
        chart.hideLoading();
        const history = res.result.data.history || [];
        this.data.allHistory = history;
        this.updateChartData('1m');
      }).catch(err => { console.error(err); chart.hideLoading(); });
      return chart;
    });
  },

  switchRange(e) {
    const range = e.currentTarget.dataset.range;
    if (range === this.data.currentRange) return;
    this.setData({ currentRange: range });
    this.updateChartData(range);
  },

  updateChartData(range) {
    if (!this.data.allHistory.length) return;
    const all = this.data.allHistory;
    let chartData = [];
    if (range === '1m') chartData = all.slice(-22);
    else if (range === '1y') chartData = all.slice(-250);
    else chartData = all;
    this.setChartOption(chartData, this.data.asset, this.data.costPrice, range);
  },

  setChartOption(dataList, asset, costPrice, range) {
    if (!chart) return;
    const dates = dataList.map(item => item.date);
    const values = dataList.map(item => item.value);

    let buyIndex = -1;
    let markLineData = [{ yAxis: costPrice, label: { formatter: '成本', position: 'end' }, lineStyle: { color: '#ff9800' } }];
    let markPointData = [];

    if (asset && asset.buyDate) {
      const targetTime = new Date(asset.buyDate.replace(/-/g, '/')).getTime();
      let minDiff = Infinity;
      dates.forEach((dateStr, index) => {
        const currTime = new Date(dateStr.replace(/-/g, '/')).getTime();
        const diff = Math.abs(currTime - targetTime);
        if (diff < 604800000 && diff < minDiff) {
          minDiff = diff;
          buyIndex = index;
        }
      });

      if (buyIndex !== -1) {
        markLineData.push({ xAxis: buyIndex, label: { show: true, formatter: '买入', position: 'start' }, lineStyle: { color: '#FA5151', type: 'dashed' } });
        markPointData.push({
          name: '买入', coord: [buyIndex, values[buyIndex]], value: '买入',
          itemStyle: { color: '#FA5151' }, symbol: 'pin', symbolSize: 45,
          tooltip: {
            show: true, trigger: 'item', backgroundColor: 'rgba(50,50,50,0.9)', textStyle: {color:'#fff'},
            formatter: () => `💰 买入金额: ¥${asset.principal}\n📅 买入日期: ${asset.buyDate}\n📉 确认净值: ${values[buyIndex]}`
          }
        });
      }
    }

    const option = {
      color: ["#1A73E8"],
      grid: { left: '10%', right: '12%', bottom: '15%', top: '15%' },
      tooltip: { trigger: 'axis', axisPointer: { type: 'line', lineStyle: { type: 'dashed' } } },
      xAxis: {
        type: 'category', data: dates, axisLine: { show: false }, axisTick: { show: false },
        axisLabel: {
          show: true, color: '#999', fontSize: 10, interval: 'auto',
          formatter: (value) => {
            const date = new Date(value.replace(/-/g, '/'));
            if (isNaN(date.getTime())) return value;
            const m = date.getMonth() + 1; const d = date.getDate(); const y = date.getFullYear();
            if (range === '1m') return `${m}-${d}`;
            if (range === '1y') return `${y.toString().slice(2)}/${m < 10 ? '0' + m : m}`;
            if (range === 'all') return `${y}`;
            return value;
          }
        }
      },
      yAxis: { type: 'value', scale: true, splitLine: { lineStyle: { color: '#f5f5f5' } } },
      series: [{
        name: '净值', type: 'line', smooth: true, symbol: 'none', lineStyle: { width: 2 },
        areaStyle: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: 'rgba(26, 115, 232, 0.2)' }, { offset: 1, color: 'rgba(26, 115, 232, 0.01)' }]) },
        data: values, markPoint: { data: markPointData }, markLine: { data: markLineData }
      }]
    };
    chart.setOption(option);
  }
});