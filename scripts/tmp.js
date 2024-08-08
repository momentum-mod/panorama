class BaseClass {
	static {
		this.subClass()
	}
}

class SubClass extends BaseClass {
	constructor() {
		console.log('hello');
	}
	
	subClass = this.constructor;
}
