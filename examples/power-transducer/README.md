# Power and transducer example

This project demonstrates the prototype's core workflow: change the `supply.voltage` value in `board.yaml`, validate the connected board, and run an operating point, 6–12 V supply sweep, or startup transient with a 40 kHz switch drive.

The transducer is represented by a simple Butterworth–Van Dyke-style electrical RLC equivalent. Its values are illustrative and intentionally marked low confidence. It predicts terminal voltage/current behavior only—not acoustic output, propagation through air or tissue, device efficacy, or safety. Replace it with measured impedance data or a traceable manufacturer model before using the results for engineering decisions.

Open this directory from the app with **Open project**, or run all three analyses from the repository root:

```sh
npm run simulate:example
```
