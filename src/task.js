const util=require('./util')

const _isEnd=Symbol('_isEnd')
const _init=Symbol('_init')

class Task{
	constructor(){
		this.reload();
		this[_init]();
	}
	reload(){
		this.allUrl=new Set() //url 去重
		this.task=[] //待执行任务
		this.tasking={} // 正在执行的任务
		this.tasked=[] // 已完成任务
		this.waitTask=[] // 失败等待重试任务
		this.failTask=[] // 失败任务
		this.timer=null
		this.pushCount=0
		this.count=0
	}
	// {url,headers,method} 新任务添加
	push(val){
		if(val[0]){
			val.forEach(item=>{
				if(!this.allUrl.has(item.url)){
					this.allUrl.add(item.url)
					item._index=util.md5(item.url)
					this.task.push(item)
					util.emit(util.config.events.taskPush,item)
				}
			})
		}else{
			if(!this.allUrl.has(val.url)){
				this.allUrl.add(val.url)
				val._index=util.md5(val.url)
				this.task.push(val)
				util.emit(util.config.events.taskPush,val)
			}
		}

	}
	//获取执行任务
	_shift(length=1){
		if(length<1||!this.hasTask()){
			return [];
		}
		let newTask=this.task.splice(0,length);
		let l=newTask.length;
		let less=length-l;
		if(less>0){
			let waitTask=this.waitTask.splice(0,less);
			console.log('_repeat:',newTask.length,less,waitTask.length,this.waitTask.length,this.count++);
			newTask.push(...waitTask);

		}
		newTask=newTask.map(item=>{
			if(typeof item._repeat==='undefined'){
				item._repeat=1;
			}else{
				item._repeat++;
			}
			this.tasking[item._index]=item;
			return item;
		})
		return newTask;
	}
	// 任务完成
	finish(index,type=true){
		if(!index){
			return;
		}
		let tasking=this.tasking;
		if(tasking[index]){
			if(type){
				this[_isEnd]()
				this.tasked.push(tasking[index])
			}else{
				this.setWaitTask(tasking[index]);
			}
			delete this.tasking[index];
		}
	}
	// 任务失败设置等待任务
	setWaitTask(item=null){
		if(!item){
			return;
		}
		if(item._repeat<util.config.retryCount){
			this.waitTask.push(item)
			util.emit(util.config.events.waitTaskPush,item)
		}else{
			this[_isEnd]()
			console.log(item.url);
			this.failTask.push(item)
		}

	}

	// 任务列表是否存zai
	hasTask(){
		return this.task.length||this.waitTask.length;
	}
	// 爬虫是否完全完成
	[_isEnd](){
		let _this=this,
			taskCount=_this.task.length,
			total=_this.failTask.length+_this.tasked.length;
		if(this.pushCount-1===total){
			let data={
					total,
					failTask:_this.failTask
				};
			util.emit('end',data)
			console.log('hasTask:',_this.task.length,_this.waitTask.length,_this.tasked.length,_this.failTask.length);
		}
	}
	[_init](){
		util.on(util.config.events.taskPush,data=>{
			this.pushCount++
		});
	}
}
module.exports=new Task();
