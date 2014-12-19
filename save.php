<?php


if ($_POST['data']) {
  $file = "data/" . $_GET['filename'];
  echo $file;
  $fh = fopen($file, 'w') or die("can't open file");
  //fwrite($fh, base64_decode($_POST['data']));
  fwrite($fh, rawUrlDecode($_POST['data']));
  fclose($fh);
}
else {
  $file = "meshes/" . $_GET['filename'];
  if (dirname($file) == "meshes" && file_exists($file)) {
    $fsize = filesize($file);
    header('Content-Type: application/octet-stream');
    header("Content-Length: ".$fsize);
    header("Content-Disposition: attachment; filename=".$_GET['name']);
    readfile($file);
  }
}

?>