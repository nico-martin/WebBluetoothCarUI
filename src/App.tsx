import React from 'react';
import ReactDOM from 'react-dom';
import { Icon, Loader, Message } from '@theme';
import cn from '@common/utils/classnames';
import { BLE_UUID } from '@common/utils/constants';
import Queue from '@common/utils/promiseQueue';
import styles from './App.css';
import BluetoothButton from './app/BluetoothButton';
import CarModel from './app/Control/Car/CarModel';
import CarSoftwareRevision from './app/Control/Car/CarSoftwareRevision';
import Footer from './app/Footer';
import RemoteControl from './app/RemoteControl';

const USE_DEMO_CONTROLS = false;
const BROWSER_SUPPORT = 'bluetooth' in navigator;

const queue = new Queue();
const mockSend = (leftSpeed, rightSpeed) => {
  console.log(leftSpeed, rightSpeed);
  return new Promise((resolve) =>
    setTimeout(() => resolve({ leftSpeed, rightSpeed }), 100)
  );
};

const App = () => {
  const [bleDevice, setBleDevice] = React.useState<BluetoothDevice>(null);
  const [bleCharMotor, setBleCharMotor] =
    React.useState<BluetoothRemoteGATTCharacteristic>(null);
  const [bleCharSoftwareVersion, setBleCharSoftwareVersion] =
    React.useState<BluetoothRemoteGATTCharacteristic>(null);
  const [bleCharModel, setBleCharModel] =
    React.useState<BluetoothRemoteGATTCharacteristic>(null);

  const [buttonLoading, setButtonLoading] = React.useState<boolean>(false);
  const [error, setError] = React.useState<string>('');
  const [powerOffLoading, setPowerOffLoading] = React.useState<boolean>(false);

  const onDisconnected = (event) => {
    const device = event.target;
    console.log(`Device ${device.name} is disconnected.`);
    setBleCharMotor(null);
  };

  const connect = async () => {
    setButtonLoading(true);
    try {
      const device = await navigator.bluetooth.requestDevice({
        //acceptAllDevices: true,
        filters: [{ name: 'WebBluetoothCar' }],
        optionalServices: [BLE_UUID.SERVICE_MOTOR, BLE_UUID.SERVICE_DEVICE],
      });
      setBleDevice(device);
      device.addEventListener('gattserverdisconnected', onDisconnected);
      const gattService = await device.gatt.connect();
      const serviceMotor = await gattService.getPrimaryService(
        BLE_UUID.SERVICE_MOTOR
      );
      const charMotor = await serviceMotor.getCharacteristic(
        BLE_UUID.CHAR_MOTOR
      );
      const serviceDevice = await gattService.getPrimaryService(
        BLE_UUID.SERVICE_DEVICE
      );
      const [charVersion, charModel] = await Promise.all([
        serviceDevice.getCharacteristic(BLE_UUID.CHAR_SOFTWARE_REVISION),
        serviceDevice.getCharacteristic(BLE_UUID.CHAR_MODEL_NUMBER),
      ]);

      setBleCharMotor(charMotor);
      setBleCharModel(charModel);
      setBleCharSoftwareVersion(charVersion);
    } catch (e) {
      setError(e.toString());
    }
    setButtonLoading(false);
  };

  const moveWheels = (
    leftSpeed: number,
    rightSpeed: number,
    important = false
  ) =>
    queue.add(() => {
      return bleCharMotor.writeValue(
        new Uint8Array([leftSpeed + 100, rightSpeed + 100])
      );
    }, important);

  return (
    <div className={styles.root}>
      {USE_DEMO_CONTROLS ? (
        <RemoteControl
          onCmd={(left, right) => queue.add(() => mockSend(left, right))}
          onCmdStop={() => {
            queue.add(() => mockSend(0, 0), true);
          }}
          className={styles.remote}
        />
      ) : bleCharMotor === null ? (
        <div className={styles.connectionErrorContainer}>
          {error !== '' && (
            <Message type="error" className={styles.connectionError}>
              {error}
            </Message>
          )}
          {BROWSER_SUPPORT ? (
            <BluetoothButton
              loading={buttonLoading}
              connect={connect}
              className={styles.bluetoothButton}
            />
          ) : (
            <Message type="error" className={styles.connectionError}>
              Your browser does not support the WebBluetooth API:{' '}
              <a href="https://caniuse.com/web-bluetooth" target="_blank">
                https://caniuse.com/web-bluetooth
              </a>
            </Message>
          )}
        </div>
      ) : (
        <React.Fragment>
          <RemoteControl
            onCmd={(left, right) => moveWheels(left, right)}
            onCmdStop={() => moveWheels(0, 0, true)}
          />
          <div className={styles.device}>
            <button
              className={styles.powerOff}
              disabled={powerOffLoading}
              onClick={() => {
                setPowerOffLoading(true);
                queue.add(() => mockSend(0, 0));
                // make sure the wheels have stopped!
                bleDevice &&
                  window.setTimeout(() => {
                    bleDevice.gatt.disconnect();
                    setPowerOffLoading(false);
                  }, 2000);
              }}
            >
              {powerOffLoading ? (
                <Loader className={styles.powerOffLoader} />
              ) : (
                <Icon icon="mdi/power" />
              )}
            </button>
            <div className={styles.deviceInfo}>
              <p>
                <b>Device Info</b>
              </p>
              <p>
                Car: <CarModel characteristic={bleCharModel} />
              </p>
              <p>
                Software Version:{' '}
                <CarSoftwareRevision characteristic={bleCharSoftwareVersion} />
              </p>
            </div>
          </div>
        </React.Fragment>
      )}
      <Footer className={cn(styles.footer)} />
    </div>
  );
};

ReactDOM.render(<App />, document.querySelector('#app'));
