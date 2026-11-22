# dsh-miku

A DeepSeek Harness web client plugin with a dancing Miku.

![Miku on the DeepSeek Harness page](screenshot.png)

## Installation

In DeepSeek Harness open **Plugins**, click **Add plugin** and paste the
repository address:

```text
https://github.com/anysda/dsh-miku
```

## Usage

Drag Miku by her body to move her. A short click opens the usage window with
DeepSeek balance and Kimi quota; dragging does not open it. The window refreshes
only while open and closes on another short click, the close button, or Escape.
It uses `DEEPSEEK_API_KEY` and `KIMI_CODING_API_KEY` from the DSH credentials
service, environment, or `~/.dsh/.credentials.yaml`.

## License

The code is under the [PolyForm Strict License 1.0.0](LICENSE): personal,
non-commercial use, no redistribution and no derived works. The model is YYB
Miku by SANMUYYB, Zero and Marie MMD; its terms are in the ReadMe next to it.
