import * as net from "net";
import { connectEventuallyUntilTimeout } from "../../../helpers";

class IosEmulatorServices implements Mobile.IiOSSimulatorService {
	private static DEFAULT_TIMEOUT = 10000;

	constructor(private $logger: ILogger,
		private $emulatorSettingsService: Mobile.IEmulatorSettingsService,
		private $errors: IErrors,
		private $childProcess: IChildProcess,
		private $devicePlatformsConstants: Mobile.IDevicePlatformsConstants,
		private $hostInfo: IHostInfo,
		private $options: ICommonOptions,
		private $iOSSimResolver: Mobile.IiOSSimResolver) { }

	public async getEmulatorId(): Promise<string> {
		return "";
	}

	public async getRunningEmulatorId(image: string): Promise<string> {
		//todo: plamen5kov: fix later if necessary
		return "";
	}

	public async checkDependencies(): Promise<void> {
		return;
	}

	public checkAvailability(dependsOnProject?: boolean): void {
		dependsOnProject = dependsOnProject === undefined ? true : dependsOnProject;

		if (!this.$hostInfo.isDarwin) {
			this.$errors.failWithoutHelp("iOS Simulator is available only on Mac OS X.");
		}

		const platform = this.$devicePlatformsConstants.iOS;
		if (dependsOnProject && !this.$emulatorSettingsService.canStart(platform)) {
			this.$errors.failWithoutHelp("The current project does not target iOS and cannot be run in the iOS Simulator.");
		}
	}

	public async startEmulator(emulatorImage?: string): Promise<string> {
		return this.$iOSSimResolver.iOSSim.startSimulator({
			id: emulatorImage,
			state: "None",
			sdkVersion: this.$options.sdk
		});
	}

	public runApplicationOnEmulator(app: string, emulatorOptions?: Mobile.IEmulatorOptions): Promise<any> {
		return this.runApplicationOnEmulatorCore(app, emulatorOptions);
	}

	public async postDarwinNotification(notification: string): Promise<void> {
		const iosSimPath = this.$iOSSimResolver.iOSSimPath;
		const nodeCommandName = process.argv[0];

		const iosSimArgs = [iosSimPath, "notify-post", notification];

		if (this.$options.device) {
			iosSimArgs.push("--device", this.$options.device);
		}

		await this.$childProcess.spawnFromEvent(nodeCommandName, iosSimArgs, "close", { stdio: "inherit" });
	}

	public async connectToPort(data: Mobile.IConnectToPortData): Promise<net.Socket> {
		try {
			const socket = await connectEventuallyUntilTimeout(() => net.connect(data.port), data.timeout || IosEmulatorServices.DEFAULT_TIMEOUT);
			return socket;
		} catch (e) {
			this.$logger.debug(e);
		}
	}

	private async runApplicationOnEmulatorCore(app: string, emulatorOptions?: Mobile.IEmulatorOptions): Promise<any> {
		this.$logger.info("Starting iOS Simulator");
		const iosSimPath = this.$iOSSimResolver.iOSSimPath;
		const nodeCommandName = process.argv[0];

		if (this.$options.availableDevices) {
			await this.$childProcess.spawnFromEvent(nodeCommandName, [iosSimPath, "device-types"], "close", { stdio: "inherit" });
			return;
		}

		let opts = [
			iosSimPath,
			"launch", app, emulatorOptions.appId // TODO: Refactor this -> should be separate parameter
		];

		if (this.$options.timeout) {
			opts = opts.concat("--timeout", this.$options.timeout);
		}

		if (this.$options.sdk) {
			opts = opts.concat("--sdkVersion", this.$options.sdk);
		}

		if (!this.$options.justlaunch) {
			opts.push("--logging");
		} else {
			if (emulatorOptions) {
				if (emulatorOptions.stderrFilePath) {
					opts = opts.concat("--stderr", emulatorOptions.stderrFilePath);
				}
				if (emulatorOptions.stdoutFilePath) {
					opts = opts.concat("--stdout", emulatorOptions.stdoutFilePath);
				}
			}

			opts.push("--exit");
		}

		if (this.$options.device) {
			opts = opts.concat("--device", this.$options.device);
		} else if (emulatorOptions && emulatorOptions.deviceType) {
			opts = opts.concat("--device", emulatorOptions.deviceType);
		}

		if (emulatorOptions && emulatorOptions.args) {
			opts.push(`--args=${emulatorOptions.args}`);
		}

		if (emulatorOptions && emulatorOptions.waitForDebugger) {
			opts.push("--waitForDebugger");
		}

		if (emulatorOptions && emulatorOptions.skipInstall) {
			opts.push("--skipInstall");
		}

		const stdioOpts = { stdio: (emulatorOptions && emulatorOptions.captureStdin) ? "pipe" : "inherit" };

		return this.$childProcess.spawn(nodeCommandName, opts, stdioOpts);
	}
}
$injector.register("iOSEmulatorServices", IosEmulatorServices);
