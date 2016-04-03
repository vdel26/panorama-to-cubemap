(function () {
  var input = document.querySelector('input[type=file]')
  var canvases = document.querySelector('.canvases')
  var ctx, ctxOut

  // generate array ranges
  function range (start, stop, step) {
    if (stop == null) {
      stop = start || 0
      start = 0
    }
    step = step || 1

    var length = Math.max(Math.ceil((stop - start) / step), 0)
    var range = Array(length)

    for (var idx = 0; idx < length; idx++, start += step) {
      range[idx] = start
    }
    return range
  }

  // clip value between min/max
  function clip (x, min, max) {
    if (x > max) return max
    if (x < min) return min
    return x
  }

  // get rgb info from an rgba pixel
  function getPixel (imageData, x, y) {
    var idx = (x + y * imageData.width) * 4
    return [imageData.data[idx], imageData.data[idx + 1], imageData.data[idx + 2]]
  }

  // set an rgba pixel (alpha defaults to opaque)
  function setPixel (imageData, x, y, r, g, b, a) {
    var idx = (x + y * imageData.width) * 4
    imageData.data[idx + 0] = r
    imageData.data[idx + 1] = g
    imageData.data[idx + 2] = b
    imageData.data[idx + 3] = a || 255
  }

  // get x,y,z coords from out image pixels coords
  //  - i,j: pixel coords
  //  - face: face number
  //  - edge: edge length
  function outImgToXYZ (i, j, face, edge) {
    var a = 2.0 * i / edge
    var b = 2.0 * j / edge

    if      (face === 0)  return { x: -1.0,    y: 1.0 - a, z: 3.0 -b }  // back
    else if (face === 1)  return { x: a - 3.0, y: -1.0,    z: 3.0 - b } // left
    else if (face === 2)  return { x: 1.0,     y: a - 5.0, z: 3.0 - b } // front
    else if (face === 3)  return { x: 7.0 - a, y: 1.0,     z: 3.0 - b } // right
    else if (face === 4)  return { x: b - 1.0, y: a - 5.0, z: 1.0 }     // top
    else if (face === 5)  return { x: 5.0 - b, y: a - 5.0, z: -1.0 }    // bottom
  }

  // convert using an inverse transformation
  function convertBack (imgIn, imgOut) {
    var inSize = [imgIn.width, imgIn.height]
    var outSize = [imgOut.width, imgOut.height]
    var edge = inSize[0] / 4 // the length of each edge in pixels

    for (var i = 0; i < outSize[0]; i++) {
      var face = Math.floor(i / edge) // 0 - back, 1 - left 2 - front, 3 - right

      var rng
      if (face === 2) rng = range(0, edge * 3)
      else rng = range(edge, edge * 2)

      for (var j=rng[0]; j <= rng[rng.length - 1]; j++) {
        var face2
        if (j < edge) face2 = 4 // top
        else if (j >= 2 * edge) face2 = 5 // bottom
        else face2 = face

        var coords = outImgToXYZ(i, j, face2, edge)
        var theta = Math.atan2(coords.y, coords.x)
        var r = Math.hypot(coords.x, coords.y)
        var phi = Math.atan2(coords.z, r)

        // source image coords
        var uf = 2.0 * edge * (theta + Math.PI) / Math.PI
        var vf = 2.0 * edge * (Math.PI / 2 - phi) / Math.PI

        // use bilinear interpolation between the four surrounding pixels
        var ui = Math.floor(uf) // coord of pixel to bottom left
        var vi = Math.floor(vf)
        var u2 = ui + 1         // coords of pixel to top right
        var v2 = vi + 1
        var mu = uf - ui        // fraction of way across pixel
        var nu = vf - vi

        // pixel values of four corners
        var A = getPixel(imgIn, ui % inSize[0], clip(vi, 0, inSize[1] - 1))
        var B = getPixel(imgIn, u2 % inSize[0], clip(vi, 0, inSize[1] - 1))
        var C = getPixel(imgIn, ui % inSize[0], clip(v2, 0, inSize[1] - 1))
        var D = getPixel(imgIn, u2 % inSize[0], clip(v2, 0, inSize[1] - 1))

        // interpolate
        var color = {}
        color.r = A[0]*(1 - mu)*(1 - nu) + B[0]*(mu)*(1 - nu) + C[0]*(1 - mu)*nu+D[0]*mu*nu
        color.g = A[1]*(1 - mu)*(1 - nu) + B[1]*(mu)*(1 - nu) + C[1]*(1 - mu)*nu+D[1]*mu*nu
        color.b = A[2]*(1 - mu)*(1 - nu) + B[2]*(mu)*(1 - nu) + C[2]*(1 - mu)*nu+D[2]*mu*nu

        setPixel(imgOut, i, j,
          Math.round(color.r),
          Math.round(color.g),
          Math.round(color.b))
      }

    }
  }

  // make background black opaque
  function opaqueBackground (imageData) {
    for (var i = 0; i < imageData.data.length; i+=4) {
      imageData.data[i]     = 0
      imageData.data[i + 1] = 0
      imageData.data[i + 2] = 0
      imageData.data[i + 3] = 255
    }
  }

  function createEl (tag, className, attrs) {
    var el = document.createElement(tag)
    el.classList.add(className)
    for (var prop in attrs) {
      el.setAttribute(prop, attrs[prop])
    }
    return el
  }

  input.addEventListener('change', function (evt) {
    var file = this.files[0]
    var reader = new FileReader()

    reader.onload = function (evt) {
      var img = new Image()
      img.src = reader.result

      // create canvases
      var canvasIn = createEl('canvas', 'canvasIn',
                              { width: img.width, height: img.height })
      var canvasOut = createEl('canvas', 'canvasOut',
                               { width: img.width, height: img.height * 3 / 2 })
      canvases.appendChild(canvasIn)
      canvases.appendChild(canvasOut)
      ctx = canvasIn.getContext('2d')
      ctxOut = canvasOut.getContext('2d')

      ctx.drawImage(img, 0, 0)

      var imgIn = ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height)
      var inSize = [imgIn.width, imgIn.height]
      var imgOut = ctxOut.createImageData(inSize[0], inSize[0] * 3 / 4)

      opaqueBackground(imgOut)
      convertBack(imgIn, imgOut)
      ctxOut.putImageData(imgOut, 0, 0)
    }

    console.log(file)
    reader.readAsDataURL(file)
  })

})()