// pages/detail/detail.js
import * as echarts from '../../ec-canvas/echarts';

let chart = null;

Page({
  data: {
    asset: {},
    fixedProfit: 0,
    totalRate: 0,
    costPrice: 0,
    ec: { lazyLoad: true }, // 必须延迟
    currentRange: '1m', 
    allHistory: [],
    depositInfo: {}
  },

  onLoad(options) {
    if (options.assetStr) {
      try {
        // ✨✨✨ 修复点：解码 -> 解析JSON ✨✨✨
        const decodedStr = decodeURIComponent(options.assetStr);
        const asset = JSON.parse(decodedStr);

        // 1. 基础计算
        const balance = parseFloat(asset.currentBalance || asset.balance || 0);
        const principal = parseFloat(asset.principal || 0);
        const profit = balance - principal;
        
        let rate = 0;
        if (principal > 0) rate = (profit / principal) * 100;

        let cost = 0;
        if (asset.type !== '银行存款' && asset.shares > 0) {
          cost = principal / parseFloat(asset.shares);
        }

        // 2. 存款计算
        let depositInfo = {};
        if (asset.type === '银行存款') {
          depositInfo = this.calcDeposit(asset);
        }

        this.setData({
          asset: asset,
          fixedProfit: profit.toFixed(2),
          totalRate: rate.toFixed(2),
          costPrice: cost.toFixed(4),
          depositInfo: depositInfo
        }, () => {
          // 3. 如果是基金，延迟画图 (给DOM渲染时间)
          if (asset.type !== '银行存款' && asset.code) {
            setTimeout(() => {
              this.getHistoryData(asset.code);
            }, 500); // 延时 500ms
          }
        });

        wx.setNavigationBarTitle({ title: asset.name });

      } catch (e) {
        console.error('解析参数失败', e);
        wx.showToast({ title: '加载失败', icon: 'error' });
      }
    }
  },

  calcDeposit(asset) {
    let result = { endDate: '--', interest: '0.00', total: asset.principal, daysLeft: 0, progress: 0 };
    if (!asset.buyDate || !asset.depositTerm || !asset.annualRate) return result;
    
    try {
      const startDate = new Date(asset.buyDate.replace(/-/g, '/'));
      const termStr = asset.depositTerm; 
      const principal = parseFloat(asset.principal);
      const rate = parseFloat(asset.annualRate) / 100; 

      let durationDays = 0; 
      let endDate = new Date(startDate);

      if (termStr.includes('年')) {
        const y = parseFloat(termStr) || 0;
        durationDays = y * 365;
        endDate.setFullYear(startDate.getFullYear() + y);
      } else if (termStr.includes('个月') || termStr.includes('月')) {
        const m = parseFloat(termStr) || 0;
        durationDays = m * 30;
        endDate.setMonth(startDate.getMonth() + m);
      } else {
        const y = parseFloat(termStr) || 0;
        durationDays = y * 365;
        endDate.setFullYear(startDate.getFullYear() + y);
      }

      const interest = principal * rate * (durationDays / 365);
      const total = principal + interest;

      const today = new Date();
      const totalTime = endDate.getTime() - startDate.getTime();
      const passTime = today.getTime() - startDate.getTime();
      let progress = 0;
      
      if (totalTime > 0) {
        progress = (passTime / totalTime) * 100;
        if (progress > 100) progress = 100;
        if (progress < 0) progress = 0;
      }

      const leftTime = endDate.getTime() - today.getTime();
      const daysLeft = Math.ceil(leftTime / (1000 * 60 * 60 * 24));

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

  getHistoryData(code) {
    const ecComponent = this.selectComponent('#mychart-dom-line');
    if (!ecComponent) {
      console.warn('未找到图表组件');
      return;
    }

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
      }).catch(err => {
        console.error(err);
        chart.hideLoading();
      });
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
      grid: { left: '10%', right: '5%', bottom: '10%', top: '10%' },
      tooltip: { trigger: 'axis' },
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
        type: 'line', smooth: true, symbol: 'none',
        areaStyle: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [{offset: 0, color: 'rgba(26,115,232,0.3)'}, {offset: 1, color: 'rgba(26,115,232,0.01)'}]) },
        data: values,
        markLine: { data: markLineData },
        markPoint: { data: markPointData, label: { show: true, fontSize: 10, color: '#fff' } }
      }]
    };
    chart.setOption(option);
  },
  
  goAddPosition() {
    const asset = this.data.asset;
    const app = getApp();
    app.globalData.tempAsset = { name: asset.name, code: asset.code, type: asset.type };
    wx.switchTab({ url: '/pages/add/add' });
  }
});