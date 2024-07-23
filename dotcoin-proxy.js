const axios = require('axios');
const fs = require('fs');
const readlineSync = require('readline-sync');
const { exec } = require('child_process');
const { HttpsProxyAgent } = require('https-proxy-agent');

class Dotcoin {
    constructor() {
        this.apikey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impqdm5tb3luY21jZXdudXlreWlkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MDg3MDE5ODIsImV4cCI6MjAyNDI3Nzk4Mn0.oZh_ECA6fA2NlwoUamf1TqF45lrMC0uIdJXvVitDbZ8';
    }
	
	getHeaders(authorization) {
		return {
			'accept': '*/*',
			'accept-language': 'en-ID,en-US;q=0.9,en;q=0.8,id;q=0.7',
			'apikey': this.apikey,
			'authorization': `Bearer ${authorization}`,
			'content-profile': 'public',
			'content-type': 'application/json',
			'origin': 'https://dot.dapplab.xyz',
			'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
			'x-client-info': 'postgrest-js/1.9.2'
		};
	}

    async http(url, headers, data = null, proxy = null) {
        let attempts = 0;
        const maxAttempts = 3;
    
        while (attempts < maxAttempts) {
            try {
                const options = { headers };
                if (proxy) {
                    options.httpsAgent = new HttpsProxyAgent(proxy);
                }
                let res;
                if (data === null) {
                    res = await axios.get(url, options);
                } else {
                    res = await axios.post(url, data, options);
                }
                if (typeof res.data !== 'object') {
                    console.log('Không nhận được phản hồi JSON hợp lệ !'.red);
                    attempts++;
                    await this.sleep(2000);
                    continue;
                }
                return res;
            } catch (error) {
                attempts++;
                console.log(`Lỗi kết nối (Lần thử ${attempts}/${maxAttempts}): ${error.message}`.red);
                if (attempts < maxAttempts) {
                    await this.sleep(5000);
                } else {
                    break;
                }
            }
        }
        throw new Error('Không thể kết nối sau 3 lần thử');
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    clearConsole() {
        if (process.platform === 'win32') {
            exec('cls');
        } else {
            exec('clear');
        }
    }

    loadCredentials() {
        try {
            const credentialsList = fs.readFileSync('authorization.txt', 'utf8').split('\n');
            return credentialsList.map(cred => cred.trim());
        } catch (error) {
            console.error("Không tìm thấy file 'authorization.txt'. Đảm bảo file nằm trong cùng thư mục với nhau.");
            return [];
        }
    }

    loadProxies() {
        try {
            const proxyList = fs.readFileSync('proxy.txt', 'utf8').split('\n');
            return proxyList.map(proxy => proxy.trim());
        } catch (error) {
            console.error("Không tìm thấy file 'proxy.txt'. Đảm bảo file nằm trong cùng thư mục với nhau.");
            return [];
        }
    }

    async checkProxyIP(proxy) {
        let attempts = 0;
        const maxAttempts = 5;
        while (attempts < maxAttempts) {
            try {
                const proxyAgent = new HttpsProxyAgent(proxy);
                const response = await axios.get('https://api.ipify.org?format=json', {
                    httpsAgent: proxyAgent
                });
                if (response.status === 200) {
                    return response.data.ip;
                } else {
                    throw new Error(`Không thể kiểm tra IP của proxy. Status code: ${response.status}`);
                }
            } catch (error) {
                attempts++;
                this.log(`Error khi kiểm tra IP của proxy (Lần thử ${attempts}/${maxAttempts}): ${error.message}`.red);
                if (attempts < maxAttempts) {
                    await this.sleep(2000);
                } else {
                    throw new Error(`Error khi kiểm tra IP của proxy sau ${maxAttempts} lần thử: ${error.message}`);
                }
            }
        }
    }

    async fetchTaskIds(authorization, proxy) {
        const url = 'https://jjvnmoyncmcewnuykyid.supabase.co/rest/v1/rpc/get_filtered_tasks';
		const headers = {
			...this.getHeaders(authorization),
		};
        const data = { 'platform': 'ios', 'locale': 'en', 'is_premium': false };
        try {
            const response = await this.http(url, headers, data, proxy);
            if (response.status === 200) {
                const tasks = response.data;
                return tasks.map(task => task.id);
            } else {
                console.error(`Không tìm được nhiệm vụ, status code: ${response.status}`);
                return [];
            }
        } catch (error) {
            console.error(`Lỗi rồi: ${error}`);
            return [];
        }
    }

    async addAttempts(lvl, authorization, currentLevel, proxy) {
        const url = 'https://jjvnmoyncmcewnuykyid.supabase.co/rest/v1/rpc/add_attempts';
		const headers = {
			...this.getHeaders(authorization),
		};

        while (true) {
            process.stdout.write(`[ Upgrade ] : Nâng lên cấp độ ${lvl}\r`);
            try {
                const data = { 'lvl': lvl };
                const response = await this.http(url, headers, data, proxy);
                const responseData = response.data;
                if (lvl > currentLevel) {
                    return false;
                }
                if (responseData.success) {
                    return true;
                } else {
                    lvl += 1;
                }
            } catch (error) {
                console.error(`Lỗi khi nâng cấp: ${error}`);
            }
        }
    }

    async autoClearTask(authorization, proxy) {
        const taskIds = await this.fetchTaskIds(authorization, proxy);
        const url = 'https://jjvnmoyncmcewnuykyid.supabase.co/rest/v1/rpc/complete_task';
		const headers = {
			...this.getHeaders(authorization),
		};
        for (const taskId of taskIds) {
            const data = { 'oid': String(taskId) };
            try {
                const response = await this.http(url, headers, data, proxy);
                if (response.status === 200) {
                    console.log(`[ Task ${taskId} ] : Hoàn thành`);
                } else {
                    console.log(`[ Task ${taskId} ] : Không thành công với mã trạng thái ${response.status}`);
                }
            } catch (error) {
                console.error(`Lỗi hoàn thành nhiệm vụ ${taskId}: ${error}`);
            }
        }
    }

    async saveCoins(coins, authorization, proxy) {
        const url = 'https://jjvnmoyncmcewnuykyid.supabase.co/rest/v1/rpc/save_coins';
		const headers = {
			...this.getHeaders(authorization),
		};
        const data = { 'coins': coins };

        try {
            const response = await this.http(url, headers, data, proxy);
            return response.data;
        } catch (error) {
            console.error(`Lỗi khi nhận coin: ${error}`);
            return false;
        }
    }

    async getUserInfo(authorization, proxy) {
        const url = 'https://jjvnmoyncmcewnuykyid.supabase.co/rest/v1/rpc/get_user_info';
		const headers = {
			...this.getHeaders(authorization),
		};
        const data = {};
        try {
            const response = await this.http(url, headers, data, proxy);
            return response.data;
        } catch (error) {
            console.error(`Không lấy được thông tin người dùng: ${error}`);
            console.log("Thử gọi lại API để lấy thông tin người dùng...");
            try {
                const response = await this.http(url, headers, data, proxy);
                return response.data;
            } catch (retryError) {
                console.error(`Lỗi khi gọi lại API: ${retryError}`);
                return null;
            }
        }
    }

    autoUpgradeDailyAttempt() {
        const userInput = readlineSync.question("Auto upgrades daily attempt (y/n): ").trim().toLowerCase();
        if (userInput === 'y') {
            try {
                const nUpgrade = parseInt(readlineSync.question("Number of upgrades? "), 10);
                return isNaN(nUpgrade) ? 0 : nUpgrade;
            } catch (error) {
                console.error("Dữ liệu nhập không hợp lệ, phải là số.");
                return 0;  
            }
        }
        return 0; 
    }

    async autoGame(authorization, coins, proxy) {
        const url = 'https://jjvnmoyncmcewnuykyid.supabase.co/rest/v1/rpc/try_your_luck';
		const headers = {
			...this.getHeaders(authorization),
		};
        const data = { 'coins': coins };
        try {
            const response = await this.http(url, headers, data, proxy);
            const responseData = response.data;
            if (responseData.success) {
                console.log(`[ Game ] : Thắng`);
            } else {
                console.log(`[ Game ] : Thua`);
            }
        } catch (error) {
            console.error(`Lỗi rồi: ${error}`);
        }
    }

	async upgradeDTCMiner(authorization, proxy) {
		const userInfo = await this.getUserInfo(authorization, proxy); 
		const url = 'https://api.dotcoin.bot/functions/v1/upgradeDTCMiner';
		const headers = {
			...this.getHeaders(authorization),
			'X-Telegram-User-Id': userInfo.id, 
		};
		const data = {};
		try {
			const response = await this.http(url, headers, data, proxy);
			if (response.status === 200) {
				if (response.data.success) {
					console.log(`[ DTC Miner ] : Nâng cấp DTC Miner thành công!`);
				} else {
					console.log(`[ DTC Miner ] : Hôm nay bạn đã nâng cấp rồi!`);
				}
			} else {
				console.error(`[ DTC Miner ] : Lỗi khi nâng cấp với mã trạng thái ${response.status}`);
			}
		} catch (error) {
			console.error(`[ DTC Miner ] : Lỗi khi nâng cấp: ${error}`);
		}
	}

	
    async main() {
        const clearTask = readlineSync.question("Auto Complete Task? (y/n): ").trim().toLowerCase() || 'n';
        const credentials = this.loadCredentials();
        const proxies = this.loadProxies();
        const nUpgrade = this.autoUpgradeDailyAttempt(); 
        const upgradeSuccess = {}; 

        while (true) {  
            for (let index = 0; index < credentials.length; index++) {
                const authorization = credentials[index];
                const proxy = proxies[index];
                const info = await this.getUserInfo(authorization, proxy);
                const ip = await this.checkProxyIP(proxy);
                console.log(`============== [ Tài khoản ${index} | ${info.first_name} ] | IP: ${ip} ==============`);

                if (!upgradeSuccess[authorization] && nUpgrade > 0) {  
                    for (let i = 0; i < nUpgrade; i++) {
                        const currentLevel = info.daily_attempts;
                        const success = await this.addAttempts(0, authorization, currentLevel, proxy);
                        if (success) {
                            upgradeSuccess[authorization] = true;  
                            console.log(`[ Upgrade ] : Thành công\r`);
                            break;
                        } else {
                            console.log(`[ Upgrade ] : Thất bại\r`);
                        }
                    }
                }

                if (info) {
                    if (clearTask === 'y') {
                        await this.autoClearTask(authorization, proxy);
                    }
                    console.log(`[ Level ] : ${info.level}`);
                    console.log(`[ Balance ] : ${info.balance}`);
                    console.log(`[ Energy ] : ${info.daily_attempts}`);
                    console.log(`[ Limit Energy ] : ${info.limit_attempts}`);
                    console.log(`[ Multitap Level ] : ${info.multiple_clicks}`);
					await this.upgradeDTCMiner(authorization, proxy);
                    await this.autoGame(authorization, 150000, proxy);
                    const energy = info.daily_attempts;
                    if (energy > 0) {
                        for (let i = 0; i < energy; i++) {
                            process.stdout.write(`[ Tap ] : Tapping...`);
                            await this.sleep(3000);
                            await this.saveCoins(20000, authorization, proxy);
                            console.log(`Thành công`);
                        }
                    } else {
                        console.log("Năng lượng đã hết. Chờ nạp năng lượng...");
                    }
                } else {
                    console.log("Token không hợp lệ, chuyển tài khoản tiếp theo");
                }
            }

            console.log("==============Tất cả tài khoản đã được xử lý=================");
            for (let i = 3000; i > 0; i--) {
                process.stdout.write(`\rBắt đầu vòng lặp sau ${i} giây...`);
                await this.sleep(1000);
            }
            console.log(); 

            this.clearConsole();
        }
    }
}

const dotCoin = new Dotcoin();
dotCoin.main();